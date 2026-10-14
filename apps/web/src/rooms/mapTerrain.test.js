import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAPS } from '../terrain/maps/index.js'
import * as Y from 'yjs'
import { createTable, fillTable } from '../net/doc.js'
import { fillMap, mapTerrain, startTable } from './table.js'

test('mapTerrain ids are mapId:index and the same on every call', () => {
  const mapId = Object.keys(MAPS)[0]
  const first = mapTerrain(mapId)
  assert.deepEqual(
    first.map((p) => p.id),
    first.map((_, i) => `${mapId}:${i}`),
  )
  assert.deepEqual(
    mapTerrain(mapId).map((p) => p.id),
    first.map((p) => p.id),
  )
})

function emptyTableBytes() {
  const doc = new Y.Doc()
  fillTable(createTable(doc), { ...startTable(null), rosters: { host: null, guest: null } })
  return Y.encodeStateAsUpdate(doc)
}

function openTable(bytes) {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, bytes)
  return createTable(doc)
}

test('fillMap writes the map and its terrain once', () => {
  const mapId = Object.keys(MAPS)[0]
  const table = openTable(emptyTableBytes())
  assert.equal(table.game.get('mapId'), null)
  assert.equal(fillMap(table, mapId), true)
  assert.equal(table.game.get('mapId'), mapId)
  assert.equal(table.terrain.read().length, MAPS[mapId].placements.length)
  assert.equal(fillMap(table, Object.keys(MAPS)[1] ?? mapId), false)
  assert.equal(table.game.get('mapId'), mapId)
})

test('fillMap does nothing without a room map or with an unknown one', () => {
  const table = openTable(emptyTableBytes())
  assert.equal(fillMap(table, null), false)
  assert.equal(fillMap(table, 'no-such-map'), false)
  assert.equal(table.game.get('mapId'), null)
  assert.equal(table.terrain.read().length, 0)
})

test('two fills of the same map merge into one set of pieces', () => {
  const mapId = Object.keys(MAPS)[0]
  const bytes = emptyTableBytes()
  const a = openTable(bytes)
  const b = openTable(bytes)
  fillMap(a, mapId)
  fillMap(b, mapId)
  Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc))
  Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc))
  for (const table of [a, b]) {
    assert.equal(table.game.get('mapId'), mapId)
    assert.equal(table.terrain.read().length, MAPS[mapId].placements.length)
  }
})
