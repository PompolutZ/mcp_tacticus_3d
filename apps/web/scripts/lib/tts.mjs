// The TTS mod on this machine: its save file, the Terrain Database, the character Database and the crisis data in it,
// and the TTS file cache.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readLuaAssignment, readLuaConstants, readLuaIndexedAssignments } from './lua-table.mjs'

const TTS_MODS = path.join(os.homedir(), 'Library/Tabletop Simulator/Mods')
const MOD_SAVE = path.join(TTS_MODS, 'Workshop/3036795456.json')
const CACHE_DIRS = ['Models', 'Images', 'Assetbundles']

let cache

function cacheMap() {
  if (!cache) {
    cache = new Map()
    for (const dir of CACHE_DIRS) {
      for (const name of fs.readdirSync(path.join(TTS_MODS, dir))) {
        cache.set(name.replace(/\.[^.]*$/, ''), path.join(TTS_MODS, dir, name))
      }
    }
  }
  return cache
}

function cacheName(url) {
  return url.replace(/[^A-Za-z0-9]/g, '')
}

// Path of the file that TTS cached for url, or null when TTS has not downloaded it.
// TTS names the file after the URL without its non-alphanumeric characters, plus an extension:
// https://d37ev18qvj5a3m.cloudfront.net/tts/terrain/ab12.obj → httpsd37ev18qvj5a3mcloudfrontnetttsterrainab12obj.obj
export function cachedFile(url) {
  if (!url) return null
  return cacheMap().get(cacheName(url)) ?? null
}

// Cache folder and extension for a downloaded file, as { dir, ext }, or null for a file of an unknown type.
// The URL extension .unity3d goes to Assetbundles and .obj to Models. Any other file must be a PNG, JPEG or WebP
// image (checked on its first bytes) and goes to Images with the extension of its type. A Steam image URL has no extension.
// kind 'model' overrides the URL: the field decides, not the extension. A Magneto construct URL ends in .jpg,
// but the mod loads it as an asset bundle. So a file of this kind is a model (.obj) or a Unity bundle (first bytes
// "UnityFS"), and goes to Models or Assetbundles. Any other kind is decided by the URL.
export function cacheTarget(url, bytes, kind) {
  const ascii = (from, to) => Buffer.from(bytes.subarray(from, to)).toString('latin1')
  if (kind === 'model') {
    if (/\.obj$/i.test(new URL(url).pathname)) return { dir: 'Models', ext: 'obj' }
    return ascii(0, 7) === 'UnityFS' ? { dir: 'Assetbundles', ext: 'unity3d' } : null
  }
  const ext = /\.(unity3d|obj)$/i.exec(new URL(url).pathname)?.[1].toLowerCase()
  if (ext === 'unity3d') return { dir: 'Assetbundles', ext: 'unity3d' }
  if (ext === 'obj') return { dir: 'Models', ext: 'obj' }
  if (ascii(1, 4) === 'PNG' && bytes[0] === 0x89) return { dir: 'Images', ext: 'png' }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { dir: 'Images', ext: 'jpg' }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { dir: 'Images', ext: 'webp' }
  return null
}

const DOWNLOAD_TIMEOUT_MS = 120_000

// Downloads url into the TTS cache, so that cachedFile finds it. Returns the path. Throws when the download fails
// or the file has an unknown type. The file is written under a temp name and renamed, so a stopped run
// leaves no half file in the cache.
// kind: see cacheTarget.
export async function downloadToCache(url, kind) {
  const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  const target = cacheTarget(url, bytes, kind)
  if (!target) throw new Error('the file is not an image, a bundle or a model')
  const name = cacheName(url)
  const file = path.join(TTS_MODS, target.dir, `${name}.${target.ext}`)
  const temp = path.join(TTS_MODS, target.dir, `.${name}.part`)
  fs.writeFileSync(temp, bytes)
  fs.renameSync(temp, file)
  cacheMap().set(name, file)
  return file
}

// Downloads the files of urls that the cache does not have, one at a time and with a line per file.
// An item is a URL, or { url, kind } with the kind of cacheTarget. Returns the failures as [{ url, reason }].
export async function downloadMissing(items) {
  const failures = []
  const wanted = new Map()
  for (const item of items) {
    const { url, kind } = typeof item === 'string' ? { url: item } : item
    if (url && !cachedFile(url) && !wanted.has(url)) wanted.set(url, kind)
  }
  for (const [url, kind] of wanted) {
    try {
      const file = await downloadToCache(url, kind)
      console.log(`  downloaded ${url} (${fs.statSync(file).size} bytes)`)
    } catch (err) {
      const reason = err.cause?.code ?? err.message
      console.log(`  download failed ${url}: ${reason}`)
      failures.push({ url, reason })
    }
  }
  return failures
}

// pieces: key → piece definition. cards: map layouts, each with placements of piece keys.
export function loadTerrainDatabase() {
  const db = readLuaAssignment(modScript('Terrain Database'), 'terrainDatabase')
  return { pieces: new Map(db.pieces.map((p) => [p.key, p])), cards: db.cards }
}

// characters: rows of characterDatabase in the mod's "Database" object (cName, ID, cBase, cModel, cCard, ...).
// affiliations: affiliation key → character names, for example asgard → ["Angela", "Beta Ray Bill", ...].
// Lua names such as `cBase = large` or `cGem = {IG.mind}` are read as the name: 'large', 'IG.mind'.
export function loadCharacterDatabase() {
  const script = modScript('Database')
  const resolveName = (name) => name
  return {
    characters: readLuaAssignment(script, 'characterDatabase', { resolveName }),
    affiliations: readLuaAssignment(script, 'allAffiliations', { resolveName }),
  }
}

// Crisis cards and what the "Setup Crisis" button of the "Automatic Crisis Deployment" object places for them.
// cards: rows of cardDatabase in "Database" with type "Crisis Card" (name, ID, tags, threat, face, back, token, released).
// tokens: rows of tokenDatabase in "Database" (name, tShape, tSize, tType, url).
// crises: rows of crisisDatabase in "Automatic Crisis Deployment" (crisisName, crisisMap, crisisToken, lock, frontName, ...).
// maps: crisisMaps of the same object, by the Lua name of the map: mapC → { tokenPos, tokenSide, tokenRot }.
// Constants of the script are read as their values: `tags = tExt` → 'Extract', `tSize = tLarge` → 0.5.
// Other names are read as the name: `crisisMap = mapC` → 'mapC', `tokenSide = {front, back}` → ['front', 'back'].
export function loadCrisisDatabase() {
  const database = modScript('Database')
  const deployment = modScript('Automatic Crisis Deployment')
  const withConstants = (source) => {
    const constants = readLuaConstants(source)
    return { resolveName: (name) => (name in constants ? constants[name] : name) }
  }
  return {
    cards: readLuaAssignment(database, 'cardDatabase', withConstants(database)).filter(
      (c) => c.type === 'Crisis Card',
    ),
    tokens: readLuaAssignment(database, 'tokenDatabase', withConstants(database)),
    // Not with constants: the map names (mapC = 3) must stay names, because they are the keys of maps
    crises: readLuaAssignment(deployment, 'crisisDatabase', { resolveName: (name) => name }),
    maps: readLuaIndexedAssignments(deployment, 'crisisMaps', withConstants(deployment)),
  }
}

// Rows of cardDatabase in "Database" with type "Tactic Card" or "Infinity Gem" (name, ID, tags, released, list,
// description, face, back). The gems have the same card size and files as the tactic cards.
// face and back are one URL, or a list with one URL per printed version of the card.
export function loadTacticCards() {
  const database = modScript('Database')
  const constants = readLuaConstants(database)
  const resolveName = (name) => (name in constants ? constants[name] : name)
  return readLuaAssignment(database, 'cardDatabase', { resolveName }).filter(
    (c) => c.type === 'Tactic Card' || c.type === 'Infinity Gem',
  )
}

let save

// The mod object with this Nickname, for example "Blue Dice Tray". Searches inside bags and boxes too.
export function modObject(nickname) {
  save ??= JSON.parse(fs.readFileSync(MOD_SAVE, 'utf8'))
  const object = findObject(save.ObjectStates, (o) => o.Nickname === nickname)
  if (!object) throw new Error(`No "${nickname}" object in ${MOD_SAVE}`)
  return object
}

function modScript(nickname) {
  return modObject(nickname).LuaScript
}

function findObject(objects = [], test) {
  for (const o of objects) {
    if (test(o)) return o
    const found = findObject(o.ContainedObjects, test)
    if (found) return found
  }
  return null
}

// Source files of a piece that the migration needs, as { role: url }
export function pieceSources(piece) {
  const a = piece.assets ?? {}
  switch (piece.type) {
    case 'Custom_Model':
      return { mesh: a.mesh, diffuse: a.diffuse, collider: a.collider || a.mesh }
    case 'Custom_Assetbundle':
      return { bundle: a.bundle }
    case 'Custom_Tile':
    case 'Custom_Token':
      return { image: a.image }
    default:
      return {}
  }
}

// Files to download for the sources of a piece (pieceSources), as { url, kind } for downloadMissing.
// A bundle is a model: the role decides, not the URL extension (see cacheTarget).
export function sourceDownloads(sources) {
  return Object.entries(sources)
    .filter(([, url]) => url)
    .map(([role, url]) => (role === 'bundle' ? { url, kind: 'model' } : { url }))
}

// The mat of a card: its first Custom_Tile placement
export function matPlacement(card, pieces) {
  return card.placements.find((p) => pieces.get(p.key)?.type === 'Custom_Tile') ?? null
}
