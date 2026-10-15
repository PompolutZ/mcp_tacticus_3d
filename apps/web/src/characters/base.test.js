import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { BASE_HALF_H, BASE_RADIUS, baseGroundY, turnBody, upright } from './base.js'

const require = createRequire(import.meta.resolve('@react-three/rapier'))
let rapier
let world

before(async () => {
  rapier = require('@dimforge/rapier3d-compat')
  await rapier.init()
  world = new rapier.World({ x: 0, y: -30, z: 0 })
  world.createCollider(rapier.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0))
  world.createCollider(rapier.ColliderDesc.cuboid(2, 1, 2).setTranslation(10, 1, 0))
  world.step()
})

const close = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} is not ${b}`)

test('upright keeps the turn around the vertical axis only', () => {
  const half = Math.SQRT1_2
  // 90 degrees around Y, plus a tilt around X
  const q = upright({ x: 0.3, y: half, z: 0, w: half })
  assert.equal(q.x, 0)
  assert.equal(q.z, 0)
  close(Math.hypot(q.y, q.w), 1)
  close(q.y, half)
})

test('upright of a fully tipped model is the identity', () => {
  assert.deepEqual(upright({ x: 1, y: 0, z: 0, w: 0 }), { x: 0, y: 0, z: 0, w: 1 })
})

test('baseGroundY: table under the base, terrain top where a piece is', () => {
  close(baseGroundY(world, rapier, 0, 0), 0)
  close(baseGroundY(world, rapier, 10, 0), 2)
  assert.ok(BASE_RADIUS > 0 && BASE_HALF_H > 0)
})

test('turnBody turns the body around Y', () => {
  let set = null
  const body = {
    rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
    setRotation: (q) => (set = { y: q.y, w: q.w }),
  }
  turnBody(body, Math.PI / 2)
  close(set.y, Math.SQRT1_2)
  close(set.w, Math.SQRT1_2)
})
