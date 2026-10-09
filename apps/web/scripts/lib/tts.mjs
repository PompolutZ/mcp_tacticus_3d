// The TTS mod on this machine: its save file, the Terrain Database, the character Database and the crisis data in it,
// and the TTS file cache.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readLuaAssignment, readLuaConstants, readLuaIndexedAssignments } from './lua-table.mjs'

export const TTS_MODS = path.join(os.homedir(), 'Library/Tabletop Simulator/Mods')
const MOD_SAVE = path.join(TTS_MODS, 'Workshop/3036795456.json')
const CACHE_DIRS = ['Models', 'Images', 'Assetbundles']

let cache

// Path of the file that TTS cached for url, or null when TTS has not downloaded it.
// TTS names the file after the URL without its non-alphanumeric characters, plus an extension:
// https://d37ev18qvj5a3m.cloudfront.net/tts/terrain/ab12.obj → httpsd37ev18qvj5a3mcloudfrontnetttsterrainab12obj.obj
export function cachedFile(url) {
  if (!url) return null
  if (!cache) {
    cache = new Map()
    for (const dir of CACHE_DIRS) {
      for (const name of fs.readdirSync(path.join(TTS_MODS, dir))) {
        cache.set(name.replace(/\.[^.]*$/, ''), path.join(TTS_MODS, dir, name))
      }
    }
  }
  return cache.get(url.replace(/[^A-Za-z0-9]/g, '')) ?? null
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

// Rows of cardDatabase in "Database" with type "Tactic Card" (name, ID, tags, released, list, description, face, back).
// face and back are one URL, or a list with one URL per printed version of the card.
export function loadTacticCards() {
  const database = modScript('Database')
  const constants = readLuaConstants(database)
  const resolveName = (name) => (name in constants ? constants[name] : name)
  return readLuaAssignment(database, 'cardDatabase', { resolveName }).filter(
    (c) => c.type === 'Tactic Card',
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

// The mat of a card: its first Custom_Tile placement
export function matPlacement(card, pieces) {
  return card.placements.find((p) => pieces.get(p.key)?.type === 'Custom_Tile') ?? null
}
