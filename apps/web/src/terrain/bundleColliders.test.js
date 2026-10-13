import { test } from 'node:test'
import assert from 'node:assert/strict'
import { colliderPose, primitiveCollider } from './bundleColliders.js'

const close = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9, `${a} vs ${b}`))
const ID = [0, 0, 0, 1]

test('box: half extents and position follow a uniform scale, x and z mirror', () => {
  const c = primitiveCollider(
    { shape: 'box', position: [1, 2, 3], quaternion: ID, halfExtents: [0.5, 0.25, 1] },
    2,
  )
  assert.equal(c.shape, 'cuboid')
  close(c.args, [1, 0.5, 2])
  close(c.position, [-2, 4, -6])
  close(c.quaternion, [0, 1, 0, 0])
})

test('box: non-uniform scale on an unturned box', () => {
  const c = primitiveCollider(
    { shape: 'box', position: [0, 0, 0], quaternion: ID, halfExtents: [1, 1, 1] },
    [1, 2, 3],
  )
  close(c.args, [1, 2, 3])
})

test('box turned 90 degrees around Y swaps the x and z scale', () => {
  const h = Math.SQRT1_2
  const c = primitiveCollider(
    { shape: 'box', position: [0, 0, 0], quaternion: [0, h, 0, h], halfExtents: [1, 1, 1] },
    [1, 2, 3],
  )
  close(c.args, [3, 2, 1])
  // 180° turn after a 90° turn is 270°
  close(c.quaternion, [0, h, 0, -h])
})

test('cylinder and capsule: radius by the radial scale, half height by y', () => {
  const cyl = primitiveCollider(
    { shape: 'cylinder', position: [0, 1, 0], quaternion: ID, radius: 2, halfHeight: 1 },
    [2, 3, 2],
  )
  assert.equal(cyl.shape, 'cylinder')
  close(cyl.args, [3, 4])
  const cap = primitiveCollider(
    { shape: 'capsule', position: [0, 0, 0], quaternion: ID, radius: 1, halfHeight: 1 },
    0.5,
  )
  assert.equal(cap.shape, 'capsule')
  close(cap.args, [0.5, 0.5])
})

test('sphere: radius by the mean scale', () => {
  const c = primitiveCollider({ shape: 'sphere', position: [0, 0, 0], radius: 2 }, [1, 2, 3])
  assert.equal(c.shape, 'ball')
  close(c.args, [4])
})

test('mesh entry is not a primitive', () => {
  assert.equal(primitiveCollider({ shape: 'mesh', position: [0, 0, 0] }, 1), null)
})

test('pose without a quaternion', () => {
  close(colliderPose({ position: [1, 1, 1] }, [1, 1, 1]).position, [-1, 1, -1])
})
