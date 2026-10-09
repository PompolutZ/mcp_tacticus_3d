import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { SCHEMA, createTable, encodeTable, fillTable, tableSchema } from './doc.js'

const STATE = {
  mapId: 'vibranium-heist',
  matTurns: 1,
  deployLine: false,
  crisis: { secure: 'a', extract: null },
  scoreMarkers: { blue: { x: 1, z: 2 }, red: { x: 3, z: 4 }, round: { x: 5, z: 6 } },
  affiliations: { blue: 'avengers', red: 'cabal' },
  rosters: { blue: { code: 'B' }, red: null },
  setup: { deck: null, ready: { blue: false, red: false } },
  terrain: [{ id: 't1', index: 0, locked: true, piece: 'crate' }],
  characters: [{ id: 'c1', key: 'cap', tokens: {} }],
  poses: { c1: { x: 1, y: 0, z: 2, qx: 0, qy: 0, qz: 0, qw: 1 } },
  tokens: [{ id: 'k1', x: 0, z: 0, heldBy: null }],
  tactics: [{ id: 'g1', key: 'x', team: 'blue', up: 'face' }],
  looseTokens: [{ id: 'l1', key: 'stun', x: 1, z: 1 }],
  tokenPiles: [],
}

// Every store of the table as plain values
function snapshot(table) {
  const names = ['game', 'rosters', 'setup', 'terrain', 'characters', 'poses', 'tokens', 'tactics']
  return Object.fromEntries(
    [...names, 'looseTokens', 'tokenPiles'].map((name) => [name, table[name].read()]),
  )
}

test('an empty table has no schema, a filled one has SCHEMA', () => {
  const table = createTable()
  assert.equal(tableSchema(table), null)
  fillTable(table, STATE)
  assert.equal(tableSchema(table), SCHEMA)
  assert.equal(table.game.get('mapId'), 'vibranium-heist')
  assert.deepEqual(table.terrain.read(), [{ id: 't1', index: 0, locked: true }])
})

test('fillTable writes one update', () => {
  const table = createTable()
  let updates = 0
  table.doc.on('update', () => updates++)
  fillTable(table, STATE)
  assert.equal(updates, 1)
})

test('encodeTable gives back the same table', () => {
  const table = createTable()
  fillTable(table, STATE)
  const doc = new Y.Doc()
  Y.applyUpdate(doc, encodeTable(table))
  assert.deepEqual(snapshot(createTable(doc)), snapshot(table))
})
