// The Yjs document of one table: its maps, and the start table. No React. The layout is
// in docs/features/peer-to-peer.md, "Yjs document", and docs/plans/implement-backend/05-yjs-state.md.

import * as Y from 'yjs'
import { createList, createRecord } from './collections.js'

// The layout version of the document. A document with another one is not used, because
// before the first release all data is test data (05-yjs-state.md, decision 11).
export const SCHEMA = 2

// The fields of the game record, besides schema
const GAME_FIELDS = [
  'mapId',
  'matTurns',
  'deployLine',
  'crisis',
  'scoreMarkers',
  'affiliations',
  'priority',
  'lastActivated',
]
const LISTS = ['terrain', 'characters', 'tokens', 'tactics', 'looseTokens', 'tokenPiles']

// The stores of the table, one per top-level map of the document. App reads and writes them with the
// hooks of useY.js. transact(fn): fn writes several stores as one change.
export function createTable(doc = new Y.Doc()) {
  return {
    doc,
    transact: (fn) => doc.transact(fn),
    game: createRecord(doc.getMap('game'), { depth: 1 }),
    rosters: createRecord(doc.getMap('rosters')),
    setup: createRecord(doc.getMap('setup'), { depth: 1 }),
    // Only the place in the map data and the lock. App adds the placement (rooms/table.js).
    terrain: createList(doc.getMap('terrain'), { fields: ['index', 'locked', 'y'] }),
    characters: createList(doc.getMap('characters')),
    // Model id → rest pose. Written when a body falls asleep, read when a model mounts.
    poses: createRecord(doc.getMap('poses')),
    // Side → tool kind → tool entry (components/storedTool.js). Depth 1, so the sides merge.
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
export function tableSchema(table) {
  return table.game.get('schema') ?? null
}

// The bytes of the table: the whole document as one Yjs update. It is the table snapshot of a multiplayer
// room (docs/features/auth.md, "Table on the server").
export function encodeTable(table) {
  return Y.encodeStateAsUpdate(table.doc)
}
