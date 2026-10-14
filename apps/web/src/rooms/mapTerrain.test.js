import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAPS } from '../terrain/maps/index.js'
import { mapTerrain } from './table.js'

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
