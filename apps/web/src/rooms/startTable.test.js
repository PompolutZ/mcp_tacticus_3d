import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { createTable, tableSchema, SCHEMA } from '../net/doc.js'
import { MAPS } from '../terrain/maps.js'
import { startTableBytes } from './startTable.js'

test('the start table has the map, the rosters and the terrain of the map', () => {
  const mapId = Object.keys(MAPS)[0]
  const rosters = { blue: null, red: { code: 'ABC' } }
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
