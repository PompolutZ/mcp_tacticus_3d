import { test } from 'node:test'
import assert from 'node:assert/strict'
import { colliderPose, primitiveCollider, transformVertices } from './bundleColliders.js'

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

test('transformVertices: identity entry mirrors x and z and scales', () => {
  const out = transformVertices([1, 2, 3, -1, 0, 4], undefined, [2, 3, 4])
  close(out, [-2, 6, -12, 2, 0, -16])
})

test('transformVertices: entry scale, turn and position come before the import turn and the scale', () => {
  const h = Math.SQRT1_2
  // entry: scale 2, turned 90 degrees around Y (x -> -z), moved by (1, 0, 0)
  const entry = { position: [1, 0, 0], quaternion: [0, h, 0, h], scale: [2, 2, 2] }
  // vertex (1, 0, 0): scaled (2, 0, 0), turned (0, 0, -2), moved (1, 0, -2), import (-1, 0, 2), scale 3
  close(transformVertices([1, 0, 0], entry, 3), [-3, 0, 6])
})

test('transformVertices: a vertex agrees with colliderPose for a collider at the entry position', () => {
  const entry = { position: [1, 2, 3], quaternion: [0, 0, 0, 1] }
  const pose = colliderPose(entry, [2, 3, 4])
  close(transformVertices([0, 0, 0], entry, [2, 3, 4]), pose.position)
})
