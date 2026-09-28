// The TTS mod on this machine: its save file, the Terrain Database in it, and the TTS file cache.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readLuaAssignment } from './lua-table.mjs'

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
  const save = JSON.parse(fs.readFileSync(MOD_SAVE, 'utf8'))
  const object = findObject(save.ObjectStates, o => o.Nickname === 'Terrain Database')
  if (!object) throw new Error(`No "Terrain Database" object in ${MOD_SAVE}`)
  const db = readLuaAssignment(object.LuaScript, 'terrainDatabase')
  return { pieces: new Map(db.pieces.map(p => [p.key, p])), cards: db.cards }
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
    case 'Custom_Model': return { mesh: a.mesh, diffuse: a.diffuse, collider: a.collider || a.mesh }
    case 'Custom_Assetbundle': return { bundle: a.bundle }
    case 'Custom_Tile':
    case 'Custom_Token': return { image: a.image }
    default: return {}
  }
}

// The mat of a card: its first Custom_Tile placement
export function matPlacement(card, pieces) {
  return card.placements.find(p => pieces.get(p.key)?.type === 'Custom_Tile') ?? null
}
