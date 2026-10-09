// The Yjs document of one table: its maps, the start table, and the game file. No React. The layout is
// in docs/feature-peer-to-peer.md, "Yjs document", and docs/plans/implement-backend/05-yjs-state.md.

import * as Y from 'yjs'
import { createList, createRecord } from './collections.js'

// The layout version of the document. A document or a game file with another one is not used, because
// before the first release all data is test data (05-yjs-state.md, decision 11).
export const SCHEMA = 1

// The fields of the game record, besides schema
const GAME_FIELDS = ['mapId', 'matTurns', 'deployLine', 'crisis', 'scoreMarkers', 'affiliations']
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
    terrain: createList(doc.getMap('terrain'), { fields: ['index', 'locked'] }),
    characters: createList(doc.getMap('characters')),
    // Model id → rest pose. Written when a body falls asleep, read when a model mounts.
    poses: createRecord(doc.getMap('poses')),
    tokens: createList(doc.getMap('tokens')),
    tactics: createList(doc.getMap('tactics')),
    looseTokens: createList(doc.getMap('looseTokens')),
    tokenPiles: createList(doc.getMap('tokenPiles')),
  }
}

// Writes a start table as one change. state: the fields of GAME_FIELDS and LISTS, rosters, setup, and
// poses (optional).
export function fillTable(table, state) {
  table.transact(() => {
    const game = Object.fromEntries(GAME_FIELDS.map((key) => [key, state[key]]))
    table.game.set({ schema: SCHEMA, ...game })
    table.rosters.set(state.rosters)
    table.setup.set(state.setup)
    table.poses.set(state.poses ?? {})
    for (const name of LISTS) table[name].set(state[name] ?? [])
  })
}

// The schema of the stored table, or null when the document is empty
export function tableSchema(table) {
  return table.game.get('schema') ?? null
}

// The bytes of a game file: the whole document as one Yjs update. It is also the table snapshot of an
// online room (docs/feature-auth.md, "Table on the server").
export function encodeGame(table) {
  return Y.encodeStateAsUpdate(table.doc)
}

// The table of a game file, or null when the bytes are not a game of this schema
export function readGame(bytes) {
  const doc = new Y.Doc()
  try {
    Y.applyUpdate(doc, bytes)
  } catch {
    doc.destroy()
    return null
  }
  const table = createTable(doc)
  if (tableSchema(table) === SCHEMA) return table
  doc.destroy()
  return null
}
