import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { createTable, tableSchema, SCHEMA } from '../net/doc.js'
import { MAPS } from '../terrain/maps/index.js'
import { startTableBytes } from './startTable.js'

test('the start table has the map, the rosters and the terrain of the map', () => {
  const mapId = Object.keys(MAPS)[0]
  const rosters = { host: null, guest: { code: 'ABC' } }
  const doc = new Y.Doc()
  Y.applyUpdate(doc, startTableBytes(mapId, rosters))
  const table = createTable(doc)
  assert.equal(tableSchema(table), SCHEMA)
  assert.equal(table.game.get('mapId'), mapId)
  assert.deepEqual(table.rosters.read(), rosters)
  const terrain = table.terrain.read()
  assert.equal(terrain.length, MAPS[mapId].placements.length)
  assert.deepEqual(
    terrain.map((p) => p.index).sort((a, b) => a - b),
    terrain.map((_, i) => i),
  )
})

test('the start table has no tools', () => {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, startTableBytes(Object.keys(MAPS)[0], { host: null, guest: null }))
  assert.deepEqual(createTable(doc).tools.read(), {})
})

test('the start table with mapId null has no map and no terrain', () => {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, startTableBytes(null, { host: null, guest: null }))
  const table = createTable(doc)
  assert.equal(tableSchema(table), SCHEMA)
  assert.equal(table.game.get('mapId'), null)
  assert.deepEqual(table.terrain.read(), [])
})

test('terrain ids are fixed per map, so two fills merge into one set', () => {
  const mapId = Object.keys(MAPS)[0]
  const a = new Y.Doc()
  const b = new Y.Doc()
  Y.applyUpdate(a, startTableBytes(mapId, { host: null, guest: null }))
  Y.applyUpdate(b, startTableBytes(mapId, { host: null, guest: null }))
  const ids = createTable(a)
    .terrain.read()
    .map((p) => p.id)
  assert.equal(ids[0], `${mapId}:${createTable(a).terrain.read()[0].index}`)
  assert.deepEqual(
    ids,
    createTable(b)
      .terrain.read()
      .map((p) => p.id),
  )
})
