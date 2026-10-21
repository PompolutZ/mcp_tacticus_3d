import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import {
  MIGRATIONS,
  OLDEST_MIGRATED,
  SCHEMA,
  createTable,
  encodeTable,
  fillTable,
  migrate,
  openAction,
  tableSchema,
} from './doc.js'

const STATE = {
  mapId: 'vibranium-heist',
  matTurns: 1,
  deployLine: false,
  crisis: { secure: 'a', extract: null },
  scoreMarkers: { host: { x: 1, z: 2 }, guest: { x: 3, z: 4 }, round: { x: 5, z: 6 } },
  affiliations: { host: 'avengers', guest: 'cabal' },
  priority: 'host',
  lastActivated: null,
  rosters: { host: { code: 'B' }, guest: null },
  setup: { deck: null, ready: { host: false, guest: false } },
  terrain: [{ id: 't1', index: 0, locked: true }],
  characters: [{ id: 'c1', key: 'cap', tokens: {} }],
  poses: { c1: { x: 1, y: 0, z: 2, qx: 0, qy: 0, qz: 0, qw: 1 } },
  tokens: [{ id: 'k1', x: 0, z: 0, heldBy: null }],
  tactics: [{ id: 'g1', key: 'x', team: 'host', up: 'face' }],
  looseTokens: [{ id: 'l1', key: 'stun', x: 1, z: 1 }],
  tokenPiles: [],
}

// Every store of the table as plain values
function snapshot(table) {
  const names = [
    'game',
    'rosters',
    'setup',
    'terrain',
    'characters',
    'poses',
    'tools',
    'dice',
    'tokens',
    'tactics',
  ]
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

const BLUE_RANGE = { which: 3, spawn: 'a1', pose: { x: 1, y: 1, z: 2, yaw: 0 } }
const RED_RANGE = { which: 5, spawn: 'b2', at: { x: 0, z: -3 } }

test('a new table has tools, empty without a start value', () => {
  const table = createTable()
  fillTable(table, STATE)
  assert.deepEqual(table.tools.read(), {})
  fillTable(table, { ...STATE, tools: { host: { range: BLUE_RANGE } } })
  assert.deepEqual(table.tools.read(), { host: { range: BLUE_RANGE } })
})

test('an entry of one side does not change the other side', () => {
  const table = createTable()
  fillTable(table, STATE)
  table.tools.setField('host', { range: BLUE_RANGE })
  table.tools.setField('guest', (side) => ({ ...side, range: RED_RANGE }))
  assert.deepEqual(table.tools.read(), { host: { range: BLUE_RANGE }, guest: { range: RED_RANGE } })
  table.tools.setField('host', (side) => ({ ...side, range: { ...side.range, spawn: 'a2' } }))
  assert.deepEqual(table.tools.get('guest'), { range: RED_RANGE })
})

test('tools of the two sides merge when written at the same time', () => {
  const a = createTable()
  fillTable(a, STATE)
  const b = createTable()
  Y.applyUpdate(b.doc, encodeTable(a))
  a.tools.setField('host', { range: BLUE_RANGE })
  b.tools.setField('guest', { range: RED_RANGE })
  Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc))
  Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc))
  const both = { host: { range: BLUE_RANGE }, guest: { range: RED_RANGE } }
  assert.deepEqual(a.tools.read(), both)
  assert.deepEqual(b.tools.read(), both)
})

const SHELF_DIE = { order: 1, place: 'shelf', face: 5 }
const AIR_DIE = { order: 2, place: 'air', pose: { x: 1, y: 2, z: 3, qx: 0, qy: 0, qz: 0, qw: 1 } }

test('a new table has no dice, and a start value is kept', () => {
  const table = createTable()
  fillTable(table, STATE)
  assert.deepEqual(table.dice.read(), {})
  const side = { critsUsed: false, dice: { aaaaaaaa: SHELF_DIE } }
  fillTable(table, { ...STATE, dice: { host: side } })
  assert.deepEqual(table.dice.read(), { host: side })
})

test('dice of the two sides merge when written at the same time', () => {
  const a = createTable()
  fillTable(a, STATE)
  const b = createTable()
  Y.applyUpdate(b.doc, encodeTable(a))
  a.dice.setField('host', { critsUsed: true, dice: { aaaaaaaa: SHELF_DIE } })
  b.dice.setField('guest', { critsUsed: false, dice: { bbbbbbbb: AIR_DIE } })
  Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc))
  Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc))
  const both = {
    host: { critsUsed: true, dice: { aaaaaaaa: SHELF_DIE } },
    guest: { critsUsed: false, dice: { bbbbbbbb: AIR_DIE } },
  }
  assert.deepEqual(a.dice.read(), both)
  assert.deepEqual(b.dice.read(), both)
})

test('writing a side deletes the dice it no longer has', () => {
  const table = createTable()
  fillTable(table, STATE)
  table.dice.setField('host', {
    critsUsed: false,
    dice: { aaaaaaaa: SHELF_DIE, bbbbbbbb: AIR_DIE },
  })
  table.dice.setField('host', { critsUsed: false, dice: { aaaaaaaa: SHELF_DIE } })
  assert.deepEqual(table.dice.get('host'), { critsUsed: false, dice: { aaaaaaaa: SHELF_DIE } })
})

test('openAction: empty fills, equal opens, older migrates, newer stays', () => {
  assert.equal(openAction(null), 'fill')
  assert.equal(openAction(2, 2), 'open')
  assert.equal(openAction(1, 2), 'migrate')
  assert.equal(openAction(3, 2), 'newer')
  assert.equal(openAction(SCHEMA), 'open')
})

test('migrate runs the steps, sets the schema, one update', () => {
  const table = createTable()
  fillTable(table, STATE)
  table.game.setField('schema', 2)
  let updates = 0
  table.doc.on('update', () => updates++)
  const ok = migrate(table, 2, {
    to: 3,
    steps: { 2: (t) => t.game.setField('matTurns', 9) },
  })
  assert.equal(ok, true)
  assert.equal(table.game.get('matTurns'), 9)
  assert.equal(tableSchema(table), 3)
  assert.equal(updates, 1)
})

test('migrate with a missing step changes nothing', () => {
  const table = createTable()
  fillTable(table, STATE)
  const before = snapshot(table)
  assert.equal(migrate(table, 2, { to: 4, steps: { 2: () => {} } }), false)
  assert.equal(tableSchema(table), SCHEMA)
  assert.deepEqual(snapshot(table), before)
})

test('migrate of a schema below OLDEST_MIGRATED returns false', () => {
  const table = createTable()
  fillTable(table, STATE)
  assert.equal(
    migrate(table, OLDEST_MIGRATED - 1, { steps: { [OLDEST_MIGRATED - 1]: () => {} } }),
    false,
  )
  assert.equal(tableSchema(table), SCHEMA)
})

test('MIGRATIONS has a step for every schema below SCHEMA, from OLDEST_MIGRATED', () => {
  for (let n = OLDEST_MIGRATED; n < SCHEMA; n++) {
    assert.equal(typeof MIGRATIONS[n], 'function', `no migration from schema ${n}`)
  }
})

test('a custom terrain piece and game.mat round-trip through the document', () => {
  const custom = {
    id: 'c-1',
    piece: 'crate',
    position: [1, 2, 3],
    rotation: [0, 45, 0],
    scale: 1.5,
    size: 2,
    tint: '#ff0000',
    locked: false,
  }
  const mat = { name: 'battle-for-asgard', rotation: 180 }
  const a = createTable()
  fillTable(a, { ...STATE, mat, terrain: [{ id: 't1', index: 0, locked: true }, custom] })
  const b = createTable()
  Y.applyUpdate(b.doc, encodeTable(a))
  assert.deepEqual(b.terrain.read(), [{ id: 't1', index: 0, locked: true }, custom])
  assert.deepEqual(b.game.get('mat'), mat)
  b.game.setField('mat', null)
  assert.equal(b.game.get('mat'), null)
})
