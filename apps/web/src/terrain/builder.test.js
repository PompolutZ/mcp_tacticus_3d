import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Box3, Vector3 } from 'three'
import {
  addPlacement,
  clearPlacements,
  movePlacement,
  newPlacement,
  pieceGroups,
  removePlacement,
  turnPlacement,
} from './builder.js'
import { IMPORT_ROTATION, restY, toThreeTransform } from './placementMove.js'

// The lowest world y (relative to the mat top) of a box after the placement transform, by brute force
function bottomOnMat(box, placement) {
  const { position, quaternion } = toThreeTransform(placement)
  const [sx, sy, sz] = Array.isArray(placement.scale)
    ? placement.scale
    : Array(3).fill(placement.scale)
  const ys = []
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const v = new Vector3(x, y, z)
        v.applyAxisAngle(new Vector3(0, 1, 0), IMPORT_ROTATION[1])
        v.multiply(new Vector3(sx, sy, sz)).applyQuaternion(quaternion)
        ys.push(v.y + position[1])
      }
  return Math.min(...ys)
}

// A mesh with its origin in the middle: half of it is under y 0
const MIDDLE = new Box3(new Vector3(-1, -2, -1), new Vector3(1, 2, 1))
const PIECE = { key: 'p', size: 2, scale: 1.5, tint: undefined }

test('a new piece rests with the bottom of its mesh on the mat top', () => {
  const p = newPlacement(PIECE, 'a', MIDDLE)
  assert.ok(Math.abs(bottomOnMat(MIDDLE, p)) < 1e-9)
})

test('the rest height follows the scale and the turn', () => {
  for (const scale of [0.5, 1, [1, 2, 1]]) {
    for (const rotation of [
      [0, 0, 0],
      [90, 30, 0],
      [0, 0, 180],
    ]) {
      const p = { ...newPlacement({ ...PIECE, scale }, 'a', MIDDLE), rotation }
      p.position[1] = restY(MIDDLE, p)
      assert.ok(Math.abs(bottomOnMat(MIDDLE, p)) < 1e-9)
    }
  }
})

test('a mesh that starts at its origin rests lower than one centered on it', () => {
  const standing = new Box3(new Vector3(-1, 0, -1), new Vector3(1, 4, 1))
  const a = newPlacement(PIECE, 'a', standing)
  const b = newPlacement(PIECE, 'b', MIDDLE)
  assert.ok(a.position[1] < b.position[1])
})

test('a move keeps the height and the other pieces', () => {
  const a = newPlacement(PIECE, 'a', MIDDLE)
  const b = newPlacement(PIECE, 'b', MIDDLE)
  const list = movePlacement([a, b], 'a', 3, 4)
  assert.equal(list[0].position[1], a.position[1])
  assert.equal(list[0].position[0], a.position[0] + 3)
  assert.notEqual(list[0].rev, a.rev)
  assert.equal(list[1], b)
  assert.equal(a.position[0], 0)
})

test('turn changes the Y rotation only, remove and clear drop pieces', () => {
  const a = newPlacement(PIECE, 'a', MIDDLE)
  const b = newPlacement(PIECE, 'b', MIDDLE)
  const list = addPlacement([a], b)
  const turned = turnPlacement(list, 'b', 1)
  assert.deepEqual(turned[1].rotation, [0, 345, 0])
  assert.deepEqual(turned[0], a)
  assert.deepEqual(
    removePlacement(list, 'a').map((p) => p.id),
    ['b'],
  )
  assert.deepEqual(clearPlacements(), [])
})

test('the filter keeps the groups that have a match', () => {
  const all = pieceGroups('')
  assert.ok(all.length > 0)
  const none = pieceGroups('zzzzzz-no-piece')
  assert.equal(none.length, 0)
  const first = all[0].pieces[0].name
  for (const g of pieceGroups(` ${first.toUpperCase()} `)) {
    assert.ok(g.pieces.every((p) => p.name.toLowerCase().includes(first.toLowerCase())))
  }
})
