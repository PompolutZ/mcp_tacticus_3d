import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { NO_ROTATION } from './characters/base.js'
import { castDown, lowerFloor, BODY_DYNAMIC, BODY_KINEMATIC_POSITION } from './physics.js'

// Headless Rapier world (the same version as the app, nested under @react-three/rapier). Fixed boxes
// stand for terrain. world.step() runs once before the casts, or castShape finds nothing.
const require = createRequire(import.meta.resolve('@react-three/rapier'))
const HALF_H = 0.059
let rapier
let world

before(async () => {
  rapier = require('@dimforge/rapier3d-compat')
  await rapier.init()
  world = new rapier.World({ x: 0, y: -30, z: 0 })
  const table = world.createCollider(
    rapier.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0),
  )
  assert.ok(table)
  // A slab on a post: the slab spans x -10..-2 at y 2..3 (its underside is 2 above the table). The post
  // is at x -10, away from the test points.
  world.createCollider(rapier.ColliderDesc.cuboid(4, 0.5, 4).setTranslation(-6, 2.5, 0))
  world.createCollider(rapier.ColliderDesc.cuboid(0.5, 1, 0.5).setTranslation(-10.5, 1, 0))
  // A low slab: its underside is 0.1 above the table, so a base does not fit under it
  world.createCollider(rapier.ColliderDesc.cuboid(2, 0.5, 2).setTranslation(10, 0.6, 0))
  world.step()
})

const shape = () => new rapier.Cylinder(HALF_H, 0.5)
const top = (x, z) => castDown(world, rapier, shape(), NO_ROTATION, x, z, HALF_H)
const lower = (x, z) => lowerFloor(world, rapier, shape(), NO_ROTATION, x, z, HALF_H, top(x, z))

test('under an overhang the lower floor is the table, the limit is the underside', () => {
  assert.ok(Math.abs(top(-6, 0) - 3) < 0.01)
  const low = lower(-6, 0)
  assert.ok(Math.abs(low.floor) < 0.01)
  assert.ok(Math.abs(low.limit - (2 - 2 * HALF_H)) < 0.01)
})

test('no overhang: no lower floor', () => {
  assert.equal(lower(0, 0), null)
})

test('too little room under the overhang: no lower floor', () => {
  assert.equal(lower(10, 0), null)
})

test('body type constants match Rapier RigidBodyType', () => {
  assert.equal(BODY_DYNAMIC, rapier.RigidBodyType.Dynamic)
  assert.equal(BODY_KINEMATIC_POSITION, rapier.RigidBodyType.KinematicPositionBased)
})
