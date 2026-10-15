import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { throwMove } from './throwPath.js'

const require = createRequire(import.meta.resolve('@react-three/rapier'))
let rapier
let world

before(async () => {
  rapier = require('@dimforge/rapier3d-compat')
  await rapier.init()
  world = new rapier.World({ x: 0, y: -30, z: 0 })
  world.createCollider(rapier.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0))
  // A wall 3 inches tall across the path, at x 10..11
  world.createCollider(rapier.ColliderDesc.cuboid(0.5, 1.5, 5).setTranslation(10.5, 1.5, 0))
  world.step()
})

const move = (over) =>
  throwMove(world, rapier, {
    start: { x: 0, z: 0 },
    dir: { x: 1, z: 0 },
    distance: 5,
    radius: 0.5,
    others: [],
    ...over,
  }).moved

test('a free path moves the full distance', () => {
  assert.equal(move({}), 5)
})

test('a wall stops the base before it', () => {
  const moved = move({ distance: 20 })
  assert.ok(moved > 8.9 && moved < 9.6, `moved ${moved}`)
})

test('another base stops the base edge to edge', () => {
  const moved = move({ others: [{ center: { x: 4, z: 0 }, radius: 0.5 }] })
  assert.ok(Math.abs(moved - 3) < 0.01, `moved ${moved}`)
})

test('the mat edge stops the base', () => {
  const moved = move({ start: { x: 0, z: 0 }, dir: { x: 0, z: 1 }, distance: 1000 })
  assert.ok(moved < 1000)
})
