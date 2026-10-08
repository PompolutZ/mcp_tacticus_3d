// Migrates the mat and terrain of one TTS map to src/assets, and prints the entries to add to
// src/terrain/pieces.js and src/terrain/maps.js.
// A "map" is a card in the mod's Terrain Database. See scripts/README.md.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { startAssetRipper } from './lib/assetripper.mjs'
import { readBundlePrefab } from './lib/bundle.mjs'
import { compressMesh, imageToWebp, MAT_SIZE, readGlb, readObj, TEXTURE_SIZE, texturesToWebp, writeGlb } from './lib/convert.mjs'
import { cachedFile, loadTerrainDatabase, matPlacement, pieceSources } from './lib/tts.mjs'
import { bundleCollider, MAP_CARD_BACK, mapCard, matImage, pieceCollider, pieceMesh, pieceTexture } from '../src/terrain/files.js'
import { findAssetByGuid } from './lib/unity-prefab.mjs'

const USAGE = `Usage:
  node scripts/migrate-terrain.mjs --list          maps whose mat is in the TTS cache, and which files are missing
  node scripts/migrate-terrain.mjs <map id|name>   convert the map's mat and pieces, print entries for pieces.js and maps.js
Options:
  --force       convert pieces, mat and map card again, even if they were migrated before
  --out <dir>   trial run: write assets to <dir>/assets and the manifest to <dir>, not to the repo`

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: { list: { type: 'boolean' }, force: { type: 'boolean' }, out: { type: 'string' }, help: { type: 'boolean', short: 'h' } },
})
if (opts.help || (!opts.list && positionals.length !== 1)) {
  console.log(USAGE)
  process.exit(opts.help ? 0 : 1)
}

const MANIFEST_FILE = path.join(import.meta.dirname, 'terrain-manifest.json')
const MANIFEST_OUT = opts.out ? path.resolve(opts.out, 'terrain-manifest.json') : MANIFEST_FILE
const ASSETS = opts.out ? path.resolve(opts.out, 'assets') : path.resolve(import.meta.dirname, '../src/assets')
// AssetRipper exports stay here after the run, so they can be inspected
const WORK_DIR = path.join(os.tmpdir(), 'mcp-assist-3d-terrain')
// Mat tile scale in TTS. At 18 the mat is 36" wide, which the app assumes.
const TTS_MAT_SCALE = 18
// The game Size in a mod piece name: "Size 3 Panther Statue", "Crystals: Size 1"
const SIZE_IN_NAME = /\bsize\s*:?\s*(\d+)\b/i
// Map card images are 800 × 1400 in the mod. They keep that size.
const CARD_SIZE = 1400

const db = loadTerrainDatabase()
// A trial run continues from its own manifest, if an earlier trial run into the same directory wrote one
const manifest = JSON.parse(fs.readFileSync(fs.existsSync(MANIFEST_OUT) ? MANIFEST_OUT : MANIFEST_FILE, 'utf8'))

if (opts.list) listMaps()
else process.exitCode = await migrate(findCard(positionals[0]))

function listMaps() {
  const rows = []
  for (const card of db.cards) {
    const mat = matPlacement(card, db.pieces)
    if (!mat || !cachedFile(pieceSources(db.pieces.get(mat.key)).image)) continue
    const keys = pieceKeys(card)
    if (!keys.length) continue
    const types = keys.map(k => db.pieces.get(k)?.type)
    const missing = keys.filter(k => missingSources(k).length)
    const migrated = keys.every(k => migratedKey(db.pieces.get(k))) && matNameFor(mat) !== null
    rows.push({ card, keys, missing, migrated, obj: types.filter(t => t === 'Custom_Model').length, bundle: types.filter(t => t === 'Custom_Assetbundle').length })
  }
  rows.sort((a, b) => a.missing.length - b.missing.length || a.card.name.localeCompare(b.card.name))
  console.log('Maps with terrain whose mat is in the TTS cache. Missing: pieces with files that TTS has not downloaded.\n')
  for (const { card, keys, missing, migrated, obj, bundle } of rows) {
    const other = keys.length - obj - bundle
    const pieces = `${keys.length} pieces: ${obj} OBJ, ${bundle} bundle${other ? `, ${other} other` : ''}`
    const status = migrated ? 'migrated' : missing.length ? `missing: ${missing.map(k => db.pieces.get(k)?.name ?? k).join(', ')}` : 'all files cached'
    console.log(`${String(card.id).padStart(4)}  ${(card.category ?? '-').padEnd(12)} ${card.name.padEnd(40)} ${pieces.padEnd(34)} ${status}`)
  }
}

function findCard(arg) {
  const cards = /^\d+$/.test(arg) ? db.cards.filter(c => c.id === Number(arg)) : db.cards.filter(c => c.name.toLowerCase() === arg.toLowerCase())
  if (cards.length === 1) return cards[0]
  if (!cards.length) throw new Error(`No map "${arg}". Run with --list to see the maps.`)
  throw new Error(`"${arg}" matches several maps. Use an id:\n${cards.map(c => `  ${c.id}  ${c.category ?? '-'}  ${c.name}`).join('\n')}`)
}

// Returns the process exit code
async function migrate(card) {
  console.log(`Map ${card.id}: ${card.name} (${card.category ?? 'no category'})\n`)
  const mat = matPlacement(card, db.pieces)
  if (!mat) throw new Error('The map has no mat (Custom_Tile)')
  const matName = migrateMat(card, mat)
  migrateCard(card)

  // mod piece key → { appKey, status, entry, warnings }
  const results = new Map()
  let ripper = null
  try {
    for (const key of pieceKeys(card)) {
      const piece = db.pieces.get(key)
      const existing = piece && migratedKey(piece)
      const missing = missingSources(key)
      if (existing && !opts.force) results.set(key, { appKey: existing, status: 'already migrated' })
      else if (missing.length) results.set(key, { status: `missing in TTS cache: ${missing.join(', ')}` })
      else if (piece.type !== 'Custom_Model' && piece.type !== 'Custom_Assetbundle') results.set(key, { status: `skipped: ${piece.type} is not supported` })
      else {
        const appKey = existing ?? newAppKey(key)
        try {
          const { entry, warnings } = piece.type === 'Custom_Model'
            ? await migrateObjPiece(piece, appKey)
            : await migrateBundlePiece(piece, appKey, ripper ??= await startAssetRipper())
          manifest.pieces[appKey] = pieceSources(piece)
          saveManifest()
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
  const code = [...results.values()].some(r => r.status.startsWith('failed')) ? 1 : 0

  const snippet = mapsSnippet(card, mat, matName, results)
  fs.mkdirSync(WORK_DIR, { recursive: true })
  const snippetFile = path.join(WORK_DIR, `${slug(card.name)}.snippet.js`)
  fs.writeFileSync(snippetFile, snippet)
  console.log(`\nEntries for src/terrain/pieces.js and maps.js (also in ${snippetFile}):\n\n${snippet}`)
  return code
}

// Distinct piece keys of a card, without the mat
function pieceKeys(card) {
  const mat = matPlacement(card, db.pieces)
  return [...new Set(card.placements.filter(p => p !== mat).map(p => p.key))]
}

// Roles of the piece's source files that are not in the TTS cache
function missingSources(key) {
  const piece = db.pieces.get(key)
  if (!piece) return ['piece is not in the Terrain Database']
  return Object.entries(pieceSources(piece)).filter(([, url]) => url && !cachedFile(url)).map(([role]) => role)
}

// App key of an already migrated piece with the same source files, or null
function migratedKey(piece) {
  const sources = JSON.stringify(pieceSources(piece))
  return Object.keys(manifest.pieces).find(k => JSON.stringify(manifest.pieces[k]) === sources) ?? null
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
  return Object.keys(manifest.mats).find(name => manifest.mats[name] === url) ?? null
}

// Returns the mat name
function migrateMat(card, mat) {
  const url = pieceSources(db.pieces.get(mat.key)).image
  let name = matNameFor(mat)
  if (name && !opts.force) return name
  if (!name) {
    name = slug(card.name)
    for (let n = 2; name in manifest.mats; n++) name = `${slug(card.name)}-${n}`
  }
  const source = cachedFile(url)
  if (!source) throw new Error(`The mat image ${url} is not in the TTS cache. Spawn the map once in TTS.`)
  fs.writeFileSync(assetPath(matImage(name)), imageToWebp(source, MAT_SIZE))
  manifest.mats[name] = url
  saveManifest()
  const [scaleX, , scaleZ] = mat.scale
  if (Math.abs(scaleX - TTS_MAT_SCALE) > 0.01 || Math.abs(scaleZ - TTS_MAT_SCALE) > 0.01) console.log(`warning: mat scale is ${mat.scale}, not ${TTS_MAT_SCALE}`)
  console.log(`Mat: converted to ${assetPath(matImage(name))}\n`)
  return name
}

// The map card (face) and the shared card back, for the lobby (docs/feature-rooms.md). The face is
// named after the map key that mapsSnippet prints. A file that exists is kept, unless --force.
function migrateCard(card) {
  for (const [url, file] of [[card.face, mapCard(slug(card.name))], [card.back, MAP_CARD_BACK]]) {
    const out = assetPath(file)
    if (fs.existsSync(out) && !opts.force) continue
    const source = cachedFile(url)
    if (!source) {
      console.log(`warning: the card image ${url} is not in the TTS cache. Take the map card out of its bag once in TTS.`)
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
  await writeGlb(assetPath(pieceMesh(appKey)), await compressMesh(await readObj(cachedFile(src.mesh)), { singleMaterial: true }))
  if (src.diffuse) fs.writeFileSync(assetPath(pieceTexture(appKey)), imageToWebp(cachedFile(src.diffuse), TEXTURE_SIZE))
  else entry.texture = false
  if (src.collider !== src.mesh) {
    entry.collider = true
    await writeGlb(assetPath(pieceCollider(appKey)), await compressMesh(await readObj(cachedFile(src.collider)), { singleMaterial: true }))
  }
  const warnings = src.diffuse ? [] : ['has no texture. Terrain.jsx does not support texture: false yet.']
  return { entry, warnings }
}

// Unity bundle piece: mesh GLB with its own materials and WebP textures, and the prefab's colliders
async function migrateBundlePiece(piece, appKey, ripper) {
  const out = path.join(WORK_DIR, appKey)
  await ripper.exportBundle(cachedFile(piece.assets.bundle), out)
  const { doc, colliders, primary, project, warnings } = await readBundlePrefab(out)
  if (piece.assets.bundleSecondary) warnings.push('has a secondary bundle, which the script ignores')

  const entry = { name: pieceName(piece), bundle: true }
  texturesToWebp(doc)
  await writeGlb(assetPath(pieceMesh(appKey)), await compressMesh(doc, { singleMaterial: false }))

  // A custom collider mesh gets its own GLB, once per mesh. The entry has its number (bundleCollider in files.js).
  const meshNumbers = new Map()
  entry.colliders = []
  for (const collider of colliders) {
    if (collider.shape !== 'mesh') {
      entry.colliders.push(collider)
      continue
    }
    const { meshGuid, ...rest } = collider
    if (!meshNumbers.has(meshGuid)) {
      // The project has Assets/Mesh/<name>.asset for the mesh, the primary export has Assets/Mesh/<name>.glb
      const asset = findAssetByGuid(project, meshGuid)
      const glb = asset && path.join(primary, path.relative(project, asset).replace(/\.[^./]*$/, '.glb'))
      if (!glb || !fs.existsSync(glb)) {
        warnings.push(`collider mesh ${meshGuid} is not in the export, so that collider is left out`)
        continue
      }
      const n = meshNumbers.size + 1
      await writeGlb(assetPath(bundleCollider(appKey, n)), await compressMesh(await readGlb(glb), { singleMaterial: true }))
      meshNumbers.set(meshGuid, n)
    }
    entry.colliders.push({ ...rest, mesh: meshNumbers.get(meshGuid) })
  }
  if (!entry.colliders.length) warnings.push('has no colliders')
  return { entry, warnings }
}

function assetPath(file) {
  const full = path.join(ASSETS, file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  return full
}

function saveManifest() {
  fs.mkdirSync(path.dirname(MANIFEST_OUT), { recursive: true })
  fs.writeFileSync(MANIFEST_OUT, `${JSON.stringify(manifest, null, 2)}\n`)
}

function slug(text) {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Entries in the style of src/terrain/pieces.js and maps.js: TTS transforms, positions relative to the mat center
function mapsSnippet(card, mat, matName, results) {
  const lines = ['// src/terrain/pieces.js, TERRAIN_PIECES: new pieces']
  for (const r of results.values()) if (r.entry) lines.push(`  '${r.appKey}': ${js(r.entry, '  ')},`)
  const [matX, , matZ] = mat.position
  lines.push(
    '',
    '// src/terrain/maps.js, MAPS',
    `  // "${card.name}" (map ${card.id} in the Terrain Database${card.category ? `, ${card.category}` : ''})`,
    `  '${slug(card.name)}': {`,
    `    name: ${js(card.name)},`,
    `    mat: '${matName}',`,
    '    // TTS rotation of the mat around Y. It is 180 for Vibranium Heist, and the app draws that mat with no turn.',
    `    matRotation: ${round(angle(mat.rotation[1]), 2)},`,
    '    placements: [',
  )
  for (const p of card.placements) {
    if (p === mat) continue
    const r = results.get(p.key)
    const position = [p.position[0] - matX, p.position[1], p.position[2] - matZ].map(v => round(v, 3))
    const rotation = p.rotation.map(v => round(angle(v), 2))
    const scale = p.scale.every(s => Math.abs(s - p.scale[0]) < 1e-3) ? round(p.scale[0], 3) : `[${p.scale.map(s => round(s, 3)).join(', ')}]`
    const tint = p.tint && p.tint.slice(0, 3).some(c => c < 0.99) ? `, tint: [${p.tint.slice(0, 3).map(c => round(c, 2)).join(', ')}]` : ''
    const size = gameSize(db.pieces.get(p.key))
    const line = `{ piece: '${r.appKey ?? p.key}',${size ? ` size: ${size},` : ''} position: [${position.join(', ')}], rotation: [${rotation.join(', ')}], scale: ${scale}${tint} },`
    lines.push(r.appKey ? `      ${line}` : `      // ${r.status.split('\n')[0]}: ${line}`)
  }
  lines.push('    ],', '  },', '')
  return lines.join('\n')
}

// JS source for a TERRAIN_PIECES entry
function js(value, indent) {
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`
  if (typeof value === 'number') return String(round(value, 4))
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) {
    if (value.every(v => typeof v !== 'object')) return `[${value.map(v => js(v, indent)).join(', ')}]`
    return `[\n${value.map(v => `${indent}  ${js(v, `${indent}  `)},`).join('\n')}\n${indent}]`
  }
  return `{ ${Object.entries(value).map(([k, v]) => `${k}: ${js(v, indent)}`).join(', ')} }`
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
  const name = piece.name.replace(new RegExp(`[\\s:,-]*${SIZE_IN_NAME.source}[\\s:,-]*`, 'i'), ' ').trim().replace(/\s+/g, ' ')
  return name ? name[0].toUpperCase() + name.slice(1) : piece.key
}

// Degrees in [-180, 180)
function angle(deg) {
  return ((deg + 180) % 360 + 360) % 360 - 180
}

function round(v, digits) {
  const r = Number(v.toFixed(digits))
  return Object.is(r, -0) ? 0 : r
}
