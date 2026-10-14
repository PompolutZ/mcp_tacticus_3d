import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import { movedPosition, toThreeTransform, turnedRotation } from './placementMove.js'

test('movedPosition: x follows, z is mirrored, y stays', () => {
  assert.deepEqual(movedPosition([1, 5, 2], 3, 4), [4, 5, -2])
})

test('a move in Three coords matches toThreeTransform of the moved placement', () => {
  const p = { position: [1, 5, 2], rotation: [0, 30, 0] }
  const before = toThreeTransform(p).position
  const after = toThreeTransform({ ...p, position: movedPosition(p.position, 3, 4) }).position
  assert.equal(after[0] - before[0], 3)
  assert.equal(after[2] - before[2], 4)
})

test('turnedRotation: Q is counter-clockwise seen from above, Y wraps into [0, 360)', () => {
  assert.deepEqual(turnedRotation([0, 0, 0], 1), [0, 345, 0])
  assert.deepEqual(turnedRotation([0, 350, 0], -1), [0, 5, 0])
  assert.deepEqual(turnedRotation([1, 90, 2], 1), [1, 75, 2])
})

test('Q turns the piece counter-clockwise in Three coords', () => {
  const { quaternion } = toThreeTransform({
    position: [0, 0, 0],
    rotation: turnedRotation([0, 0, 0], 1),
  })
  // +X turned counter-clockwise seen from above (from +Y) goes toward -Z
  const v = new Vector3(1, 0, 0).applyQuaternion(quaternion)
  assert.ok(v.z < 0)
})
