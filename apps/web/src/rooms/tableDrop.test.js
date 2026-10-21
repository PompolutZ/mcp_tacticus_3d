import { test } from 'node:test'
import assert from 'node:assert/strict'
import { droppedY, tableMat, withPlacements } from './table.js'
import { toCustomPiece } from '../terrain/storedPiece.js'
import { MAPS } from '../terrain/maps/index.js'
import { TERRAIN_PIECES } from '../terrain/pieces.js'

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
  piece: Object.keys(TERRAIN_PIECES)[0],
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

test('withPlacements: a custom piece with a key that TERRAIN_PIECES does not have is left out', () => {
  const stored = [
    { ...custom, id: 'x', piece: 'no-such-piece' },
    custom,
    { ...custom, id: 'p', piece: 'toString' },
  ]
  assert.deepEqual(withPlacements(mapId, stored), [custom])
  assert.deepEqual(withPlacements(null, stored), [custom])
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
  const before = withPlacements(mapId, [stored])[0]
  const converted = toCustomPiece(mapId, stored)
  assert.deepEqual(withPlacements(null, [converted]), [before])
  // The index stays, for the note of the placement at export
  assert.equal(converted.index, 0)
  const fell = { ...stored, y: 0.5 }
  assert.deepEqual(withPlacements(null, [toCustomPiece(mapId, fell)]), [
    withPlacements(mapId, [fell])[0],
  ])
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
