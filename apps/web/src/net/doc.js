// The Yjs document of one table: its maps, and the start table. No React. The layout is
// in docs/features/peer-to-peer.md, "Yjs document".

import * as Y from 'yjs'
import { createList, createRecord } from './collections.js'

// The layout version of the document. A document of an older one is migrated (MIGRATIONS) or, when no
// step exists, reset, because before the first release all data is test data (docs/features/peer-to-peer.md, "Yjs document"). A newer one is never opened (docs/features/rooms.md, "Storage").
export const SCHEMA = 2

// Schema n → a function that changes a table from n to n + 1. It must give the same result when two
// browsers run it on their own copies and Yjs merges them: set values by key, and do not add list
// entries with new random ids. Empty before the first release. A SCHEMA bump needs a step here (a test).
export const MIGRATIONS = {}

// The oldest schema that MIGRATIONS can lift. An older table is reset.
export const OLDEST_MIGRATED = 2

// The fields of the game record, besides schema
const GAME_FIELDS = [
  'mapId',
  'mat',
  'matTurns',
  'deployLine',
  'crisis',
  'scoreMarkers',
  'affiliations',
  'priority',
  'lastActivated',
]
const TERRAIN_FIELDS = [
  'index',
  'locked',
  'y',
  'piece',
  'position',
  'rotation',
  'scale',
  'size',
  'tint',
]
const LISTS = ['terrain', 'characters', 'tokens', 'tactics', 'looseTokens', 'tokenPiles']

// The stores of the table, one per top-level map of the document. App reads and writes them with the
// hooks of useY.js. transact(fn): fn writes several stores as one change.
/**
 * @param {import("yjs").Doc} [doc]
 * @returns {import("./types.js").Table}
 */
export function createTable(doc = new Y.Doc()) {
  return {
    doc,
    transact: (fn) => doc.transact(fn),
    game: createRecord(doc.getMap('game'), { depth: 1 }),
    rosters: createRecord(doc.getMap('rosters')),
    setup: createRecord(doc.getMap('setup'), { depth: 1 }),
    // A map piece: the place in the map data and the lock. A custom piece: the full placement. App adds the
    // placement of a map piece (rooms/table.js).
    terrain: createList(doc.getMap('terrain'), { fields: TERRAIN_FIELDS }),
    characters: createList(doc.getMap('characters')),
    // Model id → rest pose. Written when a body falls asleep, read when a model mounts.
    poses: createRecord(doc.getMap('poses')),
    // Side → tool kind → tool entry (tabletools/storedTool.js). Depth 1, so the sides merge.
    tools: createRecord(doc.getMap('tools'), { depth: 1 }),
    // Side → { critsUsed, dice: { die id → die entry } } (dice/stored.js). Depth 2, so the sides merge.
    dice: createRecord(doc.getMap('dice'), { depth: 2 }),
    // The roll history, oldest first (dice/history.js). One list for both sides; the roller appends.
    rolls: createList(doc.getMap('rolls')),
    // The game log, oldest first, the newest 300 entries (log/log.js). Setup, phases and Priority.
    log: createList(doc.getMap('log')),
    tokens: createList(doc.getMap('tokens')),
    tactics: createList(doc.getMap('tactics')),
    looseTokens: createList(doc.getMap('looseTokens')),
    tokenPiles: createList(doc.getMap('tokenPiles')),
  }
}

// Writes a start table as one change. state: the fields of GAME_FIELDS and LISTS, rosters, setup, and
// poses, tools, dice, rolls and log (optional).
/**
 * @param {import("./types.js").Table} table
 * @param {Record<string, any>} state
 */
export function fillTable(table, state) {
  table.transact(() => {
    const game = Object.fromEntries(GAME_FIELDS.map((key) => [key, state[key]]))
    table.game.set({ schema: SCHEMA, ...game })
    table.rosters.set(state.rosters)
    table.setup.set(state.setup)
    table.poses.set(state.poses ?? {})
    table.tools.set(state.tools ?? {})
    table.dice.set(state.dice ?? {})
    table.rolls.set(state.rolls ?? [])
    table.log.set(state.log ?? [])
    for (const name of LISTS) table[name].set(state[name] ?? [])
  })
}

// The schema of the stored table, or null when the document is empty
/**
 * @param {import("./types.js").Table} table
 */
export function tableSchema(table) {
  return table.game.get('schema') ?? null
}

// What to do with a table of this schema: 'fill' (empty, write the start table), 'open', 'migrate'
// (older) or 'newer' (saved by a newer app: do not open, do not write).
export function openAction(schema, current = SCHEMA) {
  if (schema === null || schema === undefined) return 'fill'
  if (schema === current) return 'open'
  return schema > current ? 'newer' : 'migrate'
}

// Lifts the table from schema `from` to `to` in one change. False, with no change, when a step is
// missing or `from` is older than OLDEST_MIGRATED.
export function migrate(table, from, { steps = MIGRATIONS, to = SCHEMA } = {}) {
  if (from < OLDEST_MIGRATED) return false
  for (let n = from; n < to; n++) if (typeof steps[n] !== 'function') return false
  table.transact(() => {
    for (let n = from; n < to; n++) steps[n](table)
    table.game.setField('schema', to)
  })
  return true
}

// The bytes of the table: the whole document as one Yjs update. It is the table snapshot of a multiplayer
// room (docs/features/auth.md, "Table on the server").
/**
 * @param {import("./types.js").Table} table
 * @returns {Uint8Array}
 */
export function encodeTable(table) {
  return Y.encodeStateAsUpdate(table.doc)
}
