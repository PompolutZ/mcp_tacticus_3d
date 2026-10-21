import { test } from 'node:test'
import assert from 'node:assert/strict'
import { droppedY, tableMat, toCustomPiece, withPlacements } from './table.js'
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

const custom = {
  id: 'c',
  piece: 'crate',
  position: [1, 2, 3],
  rotation: [0, 90, 0],
  scale: 1,
  locked: false,
}

test('withPlacements: custom pieces, with and without a map piece', () => {
  const stored = [{ id: 'a', index: 0, locked: true }, custom]
  const out = withPlacements(mapId, stored)
  assert.equal(out.length, 2)
  assert.deepEqual(out[0].position, base)
  assert.equal(out[1], custom)
  assert.deepEqual(withPlacements(mapId, [custom]), [custom])
})

test('withPlacements: no map keeps custom pieces and drops map pieces', () => {
  assert.deepEqual(withPlacements(null, [{ id: 'a', index: 0, locked: true }, custom]), [custom])
  assert.deepEqual(withPlacements(null, []), [])
})

test('withPlacements: y of a custom piece replaces its height; unchanged pieces keep their object', () => {
  const stored = [
    { ...custom, y: 0.5 },
    { id: 'a', index: 0, locked: true },
  ]
  const [c] = withPlacements(null, stored)
  assert.deepEqual(c.position, [1, 0.5, 3])
  assert.equal(withPlacements(mapId, stored)[0], withPlacements(mapId, stored)[0])
  assert.equal(withPlacements(mapId, stored)[1], withPlacements(mapId, stored)[1])
})

test('toCustomPiece keeps the placement, the lock and the id of a map piece', () => {
  const stored = { id: 'a', index: 0, locked: false }
  const { index, ...before } = withPlacements(mapId, [stored])[0]
  const converted = toCustomPiece(mapId, stored)
  assert.deepEqual(withPlacements(null, [converted]), [before])
  assert.equal(index, 0)
  assert.equal(converted.index, undefined)
  const fell = { ...stored, y: 0.5 }
  const { index: _index, ...fellPlaced } = withPlacements(mapId, [fell])[0]
  assert.deepEqual(withPlacements(null, [toCustomPiece(mapId, fell)]), [fellPlaced])
  assert.equal(toCustomPiece(mapId, custom), custom)
  assert.equal(toCustomPiece(mapId, { id: 'x', index: 99999, locked: true }), null)
})

test('tableMat: game.mat wins, null gives the mat of the map, no map no mat gives null', () => {
  const mat = { name: 'some-mat', rotation: 90 }
  assert.deepEqual(tableMat(mapId, mat), mat)
  assert.deepEqual(tableMat(mapId, null), {
    name: MAPS[mapId].mat,
    rotation: MAPS[mapId].matRotation,
  })
  assert.deepEqual(tableMat(mapId, undefined), tableMat(mapId, null))
  assert.deepEqual(tableMat(null, mat), mat)
  assert.equal(tableMat(null, null), null)
})
