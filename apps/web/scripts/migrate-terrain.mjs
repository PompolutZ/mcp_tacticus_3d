// Migrates the mat and terrain of one TTS map to src/assets, and prints the entries to add to
// src/terrain/pieces.js, and writes the map to src/terrain/maps/<id>.json and adds it to maps/index.js.
// A "map" is a card in the mod's Terrain Database. See scripts/README.md.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startAssetRipper } from './lib/assetripper.mjs'
import { readBundlePrefab } from './lib/bundle.mjs'
import {
  compressMesh,
  imageToWebp,
  mergeColliderMeshes,
  MAT_TEXTURE_SIZE,
  readGlb,
  readObj,
  TEXTURE_SIZE,
  texturesToWebp,
  writeGlb,
} from './lib/convert.mjs'
import { parseMigrateArgs } from './lib/cli.mjs'
import { outputPath, readJson, writeJson } from './lib/files.mjs'
import { slug } from './lib/keys.mjs'
import { addMapToIndex } from './lib/maps-index.mjs'
import {
  cachedFile,
  downloadMissing,
  loadTerrainDatabase,
  matPlacement,
  pieceSources,
  sourceDownloads,
} from './lib/tts.mjs'
import {
  bundleColliders,
  MAP_CARD_BACK,
  mapCard,
  matImage,
  pieceCollider,
  pieceMesh,
  pieceTexture,
} from '../src/terrain/files.js'
import { TERRAIN_PIECES } from '../src/terrain/pieces.js'
import { findAssetByGuid } from './lib/unity-prefab.mjs'

const USAGE = `Usage:
  node scripts/migrate-terrain.mjs --list          maps whose mat is in the TTS cache, and which files are missing
  node scripts/migrate-terrain.mjs --colliders-only   write the collider GLB of every migrated bundle piece again, from the TTS cache
  node scripts/migrate-terrain.mjs <map id|name>   convert the map's mat and pieces, print entries for pieces.js, write the map JSON
Options:
  --download    first download the missing mat, piece and map card files of the map into the TTS cache, one file at a time
  --colliders-only  see above. It checks the new entries against src/terrain/pieces.js and changes nothing there.
  --force       convert pieces, mat and map card again, even if they were migrated before
  --out <dir>   trial run: write assets to <dir>/assets and the manifest to <dir>, not to the repo`

const { opts, positionals } = parseMigrateArgs(
  USAGE,
  (opts, positionals) => opts.list || opts['colliders-only'] || positionals.length === 1,
  { download: true, collidersOnly: true },
)

const MANIFEST_FILE = path.join(import.meta.dirname, 'terrain-manifest.json')
const MANIFEST_OUT = opts.out ? path.resolve(opts.out, 'terrain-manifest.json') : MANIFEST_FILE
const ASSETS = opts.out
  ? path.resolve(opts.out, 'assets')
  : path.resolve(import.meta.dirname, '../src/assets')
// AssetRipper exports stay here after the run, so they can be inspected
const MAPS_DIR = path.join(import.meta.dirname, '../src/terrain/maps')
const WORK_DIR = path.join(os.tmpdir(), 'mcp-assist-3d-terrain')
// Mat tile scale in TTS. At 18 the mat is 36" wide, which the app assumes.
const TTS_MAT_SCALE = 18
// The game Size in a mod piece name: "Size 3 Panther Statue", "Crystals: Size 1"
const SIZE_IN_NAME = /\bsize\s*:?\s*(\d+)\b/i
// Map card images are 800 × 1400 in the mod. They keep that size.
const CARD_SIZE = 1400

const db = loadTerrainDatabase()
// A trial run continues from its own manifest, if an earlier trial run into the same directory wrote one
const manifest = readJson(MANIFEST_OUT, MANIFEST_FILE)

if (opts.list) listMaps()
else if (opts['colliders-only']) process.exitCode = await rewriteColliders()
else process.exitCode = await migrate(findCard(positionals[0]))

function listMaps() {
  const rows = []
  for (const card of db.cards) {
    const mat = matPlacement(card, db.pieces)
    if (!mat || !cachedFile(pieceSources(db.pieces.get(mat.key)).image)) continue
    const keys = pieceKeys(card)
    if (!keys.length) continue
    const types = keys.map((k) => db.pieces.get(k)?.type)
    const missing = keys.filter((k) => missingSources(k).length)
    const migrated = keys.every((k) => migratedKey(db.pieces.get(k))) && matNameFor(mat) !== null
    rows.push({
      card,
      keys,
      missing,
      migrated,
      obj: types.filter((t) => t === 'Custom_Model').length,
      bundle: types.filter((t) => t === 'Custom_Assetbundle').length,
    })
  }
  rows.sort((a, b) => a.missing.length - b.missing.length || a.card.name.localeCompare(b.card.name))
  console.log(
    'Maps with terrain whose mat is in the TTS cache. Missing: pieces with files that TTS has not downloaded.\n',
  )
  for (const { card, keys, missing, migrated, obj, bundle } of rows) {
    const other = keys.length - obj - bundle
    const pieces = `${keys.length} pieces: ${obj} OBJ, ${bundle} bundle${other ? `, ${other} other` : ''}`
    const status = migrated
      ? 'migrated'
      : missing.length
        ? `missing: ${missing.map((k) => db.pieces.get(k)?.name ?? k).join(', ')}`
        : 'all files cached'
    console.log(
      `${String(card.id).padStart(4)}  ${(card.category ?? '-').padEnd(12)} ${card.name.padEnd(40)} ${pieces.padEnd(34)} ${status}`,
    )
  }
}

function findCard(arg) {
  const cards = /^\d+$/.test(arg)
    ? db.cards.filter((c) => c.id === Number(arg))
    : db.cards.filter((c) => c.name.toLowerCase() === arg.toLowerCase())
  if (cards.length === 1) return cards[0]
  if (!cards.length) throw new Error(`No map "${arg}". Run with --list to see the maps.`)
  throw new Error(
    `"${arg}" matches several maps. Use an id:\n${cards.map((c) => `  ${c.id}  ${c.category ?? '-'}  ${c.name}`).join('\n')}`,
  )
}

// Returns the process exit code
async function migrate(card) {
  console.log(`Map ${card.id}: ${card.name} (${card.category ?? 'no category'})\n`)
  const mat = matPlacement(card, db.pieces)
  if (!mat) throw new Error('The map has no mat (Custom_Tile)')
  const matName = await migrateMat(card, mat)
  await migrateCard(card)

  // mod piece key → { appKey, status, entry, warnings }
  const results = new Map()
  let ripper = null
  try {
    for (const key of pieceKeys(card)) {
      const piece = db.pieces.get(key)
      const existing = piece && migratedKey(piece)
      let downloadFailed = []
      if (opts.download && piece && !(existing && !opts.force))
        downloadFailed = await downloadMissing(sourceDownloads(pieceSources(piece)))
      const missing = missingSources(key)
      if (existing && !opts.force)
        results.set(key, { appKey: existing, status: 'already migrated' })
      else if (downloadFailed.length)
        results.set(key, {
          status: `failed: download ${downloadFailed.map((f) => `${f.url} (${f.reason})`).join(', ')}`,
        })
      else if (missing.length)
        results.set(key, { status: `missing in TTS cache: ${missing.join(', ')}` })
      else if (piece.type !== 'Custom_Model' && piece.type !== 'Custom_Assetbundle')
        results.set(key, { status: `skipped: ${piece.type} is not supported` })
      else {
        const appKey = existing ?? newAppKey(key)
        try {
          const { entry, warnings } =
            piece.type === 'Custom_Model'
              ? await migrateObjPiece(piece, appKey)
              : await migrateBundlePiece(piece, appKey, (ripper ??= await startAssetRipper()))
          manifest.pieces[appKey] = pieceSources(piece)
          writeJson(MANIFEST_OUT, manifest, { sortKeys: false })
          results.set(key, { appKey, status: 'converted', entry, warnings })
        } catch (err) {
          results.set(key, { status: `failed: ${err.stack}` })
        }
      }
    }
  } finally {
    ripper?.stop()
  }

  console.log('Pieces:')
  for (const [key, r] of results) {
    console.log(`  ${key}${r.appKey && r.appKey !== key ? ` → ${r.appKey}` : ''}: ${r.status}`)
    for (const w of r.warnings ?? []) console.log(`    warning: ${w}`)
  }
  const code = [...results.values()].some((r) => r.status.startsWith('failed')) ? 1 : 0

  const snippet = piecesSnippet(results)
  fs.mkdirSync(WORK_DIR, { recursive: true })
  const snippetFile = path.join(WORK_DIR, `${mapSlug(card.name)}.snippet.js`)
  fs.writeFileSync(snippetFile, snippet)
  console.log(`\nEntries for src/terrain/pieces.js (also in ${snippetFile}):\n\n${snippet}\n`)
  console.log(`Map written: ${writeMap(mapJson(card, mat, matName, results))}`)
  return code
}

// Distinct piece keys of a card, without the mat
function pieceKeys(card) {
  const mat = matPlacement(card, db.pieces)
  return [...new Set(card.placements.filter((p) => p !== mat).map((p) => p.key))]
}

// Roles of the piece's source files that are not in the TTS cache
function missingSources(key) {
  const piece = db.pieces.get(key)
  if (!piece) return ['piece is not in the Terrain Database']
  return Object.entries(pieceSources(piece))
    .filter(([, url]) => url && !cachedFile(url))
    .map(([role]) => role)
}

// App key of an already migrated piece with the same source files, or null
function migratedKey(piece) {
  const sources = JSON.stringify(pieceSources(piece))
  return (
    Object.keys(manifest.pieces).find((k) => JSON.stringify(manifest.pieces[k]) === sources) ?? null
  )
}

// The mod key, made unique among the migrated pieces
function newAppKey(modKey) {
  let key = modKey
  for (let n = 2; key in manifest.pieces; n++) key = `${modKey}-${n}`
  return key
}

// Name of the migrated mat with the same image, or null
function matNameFor(mat) {
  const url = pieceSources(db.pieces.get(mat.key)).image
  return Object.keys(manifest.mats).find((name) => manifest.mats[name] === url) ?? null
}

// Returns the mat name
async function migrateMat(card, mat) {
  const url = pieceSources(db.pieces.get(mat.key)).image
  let name = matNameFor(mat)
  if (name && !opts.force) return name
  if (!name) {
    name = mapSlug(card.name)
    for (let n = 2; name in manifest.mats; n++) name = `${mapSlug(card.name)}-${n}`
  }
  if (opts.download) {
    const [failed] = await downloadMissing([url])
    if (failed) throw new Error(`Download of the mat image ${url} failed (${failed.reason})`)
  }
  const source = cachedFile(url)
  if (!source)
    throw new Error(`The mat image ${url} is not in the TTS cache. Spawn the map once in TTS.`)
  fs.writeFileSync(outputPath(ASSETS, matImage(name)), imageToWebp(source, MAT_TEXTURE_SIZE))
  manifest.mats[name] = url
  writeJson(MANIFEST_OUT, manifest, { sortKeys: false })
  const [scaleX, , scaleZ] = mat.scale
  if (Math.abs(scaleX - TTS_MAT_SCALE) > 0.01 || Math.abs(scaleZ - TTS_MAT_SCALE) > 0.01)
    console.log(`warning: mat scale is ${mat.scale}, not ${TTS_MAT_SCALE}`)
  console.log(`Mat: converted to ${outputPath(ASSETS, matImage(name))}\n`)
  return name
}

// The map card (face) and the shared card back, for the lobby (docs/features/rooms.md). The face is
// named after the map id that mapJson writes. A file that exists is kept, unless --force.
async function migrateCard(card) {
  for (const [url, file] of [
    [card.face, mapCard(mapSlug(card.name))],
    [card.back, MAP_CARD_BACK],
  ]) {
    const out = outputPath(ASSETS, file)
    if (fs.existsSync(out) && !opts.force) continue
    if (opts.download) await downloadMissing([url]) // a failure is a warning below
    const source = cachedFile(url)
    if (!source) {
      console.log(
        `warning: the card image ${url} is not in the TTS cache. Take the map card out of its bag once in TTS.`,
      )
      continue
    }
    fs.writeFileSync(out, imageToWebp(source, CARD_SIZE))
    console.log(`Card: converted to ${out}`)
  }
  console.log()
}

// OBJ piece: mesh GLB with one material, texture as a separate WebP (Terrain.jsx puts them together).
// The entry has no paths: the files are named after the key (src/terrain/files.js).
async function migrateObjPiece(piece, appKey) {
  const src = pieceSources(piece)
  // convex is the mod's collider flag. true: Unity uses the convex hull of the collider mesh.
  const entry = { name: pieceName(piece), convex: piece.convex === true }
  await writeGlb(
    outputPath(ASSETS, pieceMesh(appKey)),
    await compressMesh(await readObj(cachedFile(src.mesh)), { singleMaterial: true }),
  )
  if (src.diffuse)
    fs.writeFileSync(
      outputPath(ASSETS, pieceTexture(appKey)),
      imageToWebp(cachedFile(src.diffuse), TEXTURE_SIZE),
    )
  else entry.texture = false
  if (src.collider !== src.mesh) {
    entry.collider = true
    await writeGlb(
      outputPath(ASSETS, pieceCollider(appKey)),
      await compressMesh(await readObj(cachedFile(src.collider)), { singleMaterial: true }),
    )
  }
  const warnings = src.diffuse
    ? []
    : ['has no texture. Terrain.jsx does not support texture: false yet.']
  return { entry, warnings }
}

// Unity bundle piece: mesh GLB with its own materials and WebP textures, and the prefab's colliders
async function migrateBundlePiece(piece, appKey, ripper) {
  const out = path.join(WORK_DIR, appKey)
  await ripper.exportBundle(cachedFile(piece.assets.bundle), out)
  const { doc, colliders, primary, project, warnings } = await readBundlePrefab(out)
  if (piece.assets.bundleSecondary)
    warnings.push('has a secondary bundle, which the script ignores')

  const entry = { name: pieceName(piece), bundle: true }
  texturesToWebp(doc)
  await writeGlb(
    outputPath(ASSETS, pieceMesh(appKey)),
    await compressMesh(doc, { singleMaterial: false }),
  )

  entry.colliders = await writeBundleColliders(appKey, colliders, primary, project, warnings)
  if (!entry.colliders.length) warnings.push('has no colliders')
  return { entry, warnings }
}

// The collider meshes of a bundle piece go into one GLB, one node each (bundleColliders in files.js). A `mesh` entry
// has the index of its node. A mesh that several colliders use is in the file once. Returns the `colliders` entries.
async function writeBundleColliders(appKey, colliders, primary, project, warnings) {
  const meshIndex = new Map()
  const docs = []
  const entries = []
  for (const collider of colliders) {
    if (collider.shape !== 'mesh') {
      entries.push(collider)
      continue
    }
    const { meshGuid, ...rest } = collider
    if (!meshIndex.has(meshGuid)) {
      // The project has Assets/Mesh/<name>.asset for the mesh, the primary export has Assets/Mesh/<name>.glb
      const asset = findAssetByGuid(project, meshGuid)
      const glb =
        asset && path.join(primary, path.relative(project, asset).replace(/\.[^./]*$/, '.glb'))
      if (!glb || !fs.existsSync(glb)) {
        warnings.push(
          `collider mesh ${meshGuid} is not in the export, so that collider is left out`,
        )
        continue
      }
      meshIndex.set(meshGuid, docs.length)
      docs.push(await readGlb(glb))
    }
    entries.push({ ...rest, mesh: meshIndex.get(meshGuid) })
  }
  if (docs.length)
    await writeGlb(outputPath(ASSETS, bundleColliders(appKey)), await mergeColliderMeshes(docs))
  return entries
}

// --colliders-only: the collider GLB of every migrated bundle piece again, from the cached bundles.
// The entries it finds must be the ones in pieces.js. Returns the exit code.
async function rewriteColliders() {
  const ripper = await startAssetRipper()
  let code = 0
  try {
    for (const [appKey, sources] of Object.entries(manifest.pieces)) {
      if (!sources.bundle) continue
      const file = cachedFile(sources.bundle)
      if (!file) {
        console.log(`${appKey}: bundle is not in the TTS cache`)
        code = 1
        continue
      }
      const out = path.join(WORK_DIR, appKey)
      await ripper.exportBundle(file, out)
      const { colliders, primary, project, warnings } = await readBundlePrefab(out)
      const entries = await writeBundleColliders(appKey, colliders, primary, project, warnings)
      const same = sameEntries(entries, TERRAIN_PIECES[appKey]?.colliders)
      if (!same) code = 1
      console.log(
        `${appKey}: ${entries.filter((e) => e.shape === 'mesh').length} mesh colliders, ${same ? 'entries as in pieces.js' : 'ENTRIES DIFFER from pieces.js'}`,
      )
    }
  } finally {
    ripper.stop()
  }
  return code
}

// pieces.js has the numbers rounded to 4 digits (js() below)
function sameEntries(a, b) {
  const rounded = (v) => JSON.stringify(v, (_, x) => (typeof x === 'number' ? round(x, 4) : x))
  return rounded(a) === rounded(b)
}

// Keys of the mod's maps keep the punctuation as a dash: "King T'Challa" → king-t-challa
function mapSlug(text) {
  return slug(text, { keepPunctuation: true })
}

// Entries for src/terrain/pieces.js: new pieces, in the style of that file
function piecesSnippet(results) {
  const lines = ['// src/terrain/pieces.js, TERRAIN_PIECES: new pieces']
  for (const r of results.values())
    if (r.entry) lines.push(`  '${r.appKey}': ${js(r.entry, '  ')},`)
  return lines.join('\n')
}

// The map as in src/terrain/maps/<id>.json (docs/features/maps.md): TTS transforms, positions relative to
// the mat center. A placement of a piece that was not converted goes to `skipped`, with the reason as `note`
// (no note when the mod type is not supported).
function mapJson(card, mat, matName, results) {
  const [matX, , matZ] = mat.position
  const placements = []
  const skipped = []
  for (const p of card.placements) {
    if (p === mat) continue
    const r = results.get(p.key)
    const size = gameSize(db.pieces.get(p.key))
    const scale = p.scale.every((s) => Math.abs(s - p.scale[0]) < 1e-3)
      ? round(p.scale[0], 3)
      : p.scale.map((s) => round(s, 3))
    const placement = { piece: r.appKey ?? p.key }
    if (size) placement.size = size
    placement.position = [p.position[0] - matX, p.position[1], p.position[2] - matZ].map((v) =>
      round(v, 3),
    )
    placement.rotation = p.rotation.map((v) => round(angle(v), 2))
    placement.scale = scale
    if (p.tint && p.tint.slice(0, 3).some((c) => c < 0.99))
      placement.tint = p.tint.slice(0, 3).map((c) => round(c, 2))
    if (r.appKey) placements.push(placement)
    else {
      const status = r.status.split('\n')[0]
      if (!status.startsWith('skipped:')) placement.note = status
      skipped.push(placement)
    }
  }
  const map = { id: mapSlug(card.name), name: card.name }
  if (card.id != null) map.ttsMap = card.id
  map.mat = matName
  map.matRotation = (round(angle(mat.rotation[1]), 2) + 360) % 360 // 0 to 359.99, as stored in the maps
  map.placements = placements
  if (skipped.length) map.skipped = skipped
  return map
}

// Writes the map JSON, and adds the map to src/terrain/maps/index.js. A trial run (--out) writes the JSON
// to <dir>/maps and leaves index.js alone. Returns the JSON file.
function writeMap(map) {
  const dir = opts.out ? path.resolve(opts.out, 'maps') : MAPS_DIR
  const file = path.join(dir, `${map.id}.json`)
  writeJson(file, map, { sortKeys: false })
  if (!opts.out) {
    const index = path.join(MAPS_DIR, 'index.js')
    fs.writeFileSync(index, addMapToIndex(fs.readFileSync(index, 'utf8'), map.id))
  }
  return file
}

// JS source for a TERRAIN_PIECES entry
function js(value, indent) {
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`
  if (typeof value === 'number') return String(round(value, 4))
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v !== 'object'))
      return `[${value.map((v) => js(v, indent)).join(', ')}]`
    return `[\n${value.map((v) => `${indent}  ${js(v, `${indent}  `)},`).join('\n')}\n${indent}]`
  }
  return `{ ${Object.entries(value)
    .map(([k, v]) => `${k}: ${js(v, indent)}`)
    .join(', ')} }`
}

// The game Size of a mod piece, from its name ("Size 3 Panther Statue", "Crystals: Size 1"), or null.
// It belongs to the mod piece, not to the mesh: two mod pieces with the same files get one app piece.
function gameSize(piece) {
  const match = piece?.name?.match(SIZE_IN_NAME)
  return match ? Number(match[1]) : null
}

// Display name of a mod piece: its name without the Size and the separators around it
// ("Size 3 Panther Statue" → "Panther Statue", "Portal: Size 4, delete all as one" → "Portal delete all as one"),
// with the first letter in upper case. A name that is only a Size ("Size: 1") gives the mod key.
function pieceName(piece) {
  const name = piece.name
    .replace(new RegExp(`[\\s:,-]*${SIZE_IN_NAME.source}[\\s:,-]*`, 'i'), ' ')
    .replace(/\(\s*\)/g, ' ') // "Statue (Size 2)" leaves "Statue ( )"
    .trim()
    .replace(/\s+/g, ' ')
  return name ? name[0].toUpperCase() + name.slice(1) : piece.key
}

// Degrees in [-180, 180)
function angle(deg) {
  return ((((deg + 180) % 360) + 360) % 360) - 180
}

function round(v, digits) {
  const r = Number(v.toFixed(digits))
  return Object.is(r, -0) ? 0 : r
}
