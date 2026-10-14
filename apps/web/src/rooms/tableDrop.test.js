import { test } from 'node:test'
import assert from 'node:assert/strict'
import { droppedY, withPlacements } from './table.js'
import { MAPS } from '../terrain/maps/index.js'

const mapId = Object.keys(MAPS)[0]
const base = MAPS[mapId].placements[0].position

test('withPlacements: no y keeps the map height', () => {
  const [p] = withPlacements(mapId, [{ id: 'a', index: 0, locked: true }])
  assert.deepEqual(p.position, base)
  assert.equal('y' in p, false)
})

test('withPlacements: y replaces only the height', () => {
  const [p] = withPlacements(mapId, [{ id: 'a', index: 0, locked: true, y: 0.5 }])
  assert.deepEqual(p.position, [base[0], 0.5, base[2]])
})

test('droppedY: position y minus the fall, to 3 decimals', () => {
  assert.equal(droppedY([1, 2.774, 3], 0.7884), 1.986)
})
