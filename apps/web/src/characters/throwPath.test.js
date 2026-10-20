import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { throwMove, slidePath } from './throwPath.js'

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

const pt = (x, z, y = 0) => ({ x, y, z })

test('a longer slide takes longer', () => {
  const short = slidePath([pt(0, 0), pt(10, 0)])
  const long = slidePath([pt(0, 0), pt(100, 0)])
  assert.ok(long.duration > short.duration)
})

test('a slide never takes less than the minimum', () => {
  const tiny = slidePath([pt(0, 0), pt(0.01, 0)])
  const none = slidePath([pt(1, 1), pt(1, 1)])
  const long = slidePath([pt(0, 0), pt(100, 0)])
  assert.ok(tiny.duration > 0)
  assert.equal(tiny.duration, none.duration)
  assert.ok(long.duration > tiny.duration)
})

test('the slide path starts at the first point and ends at the last', () => {
  const points = [pt(0, 0, 1), pt(4, 0, 1), pt(4, 3, 2)]
  const { path } = slidePath(points)
  assert.deepEqual(path(0), points[0])
  assert.deepEqual(path(1), points[2])
})

test('the slide path follows the bend and moves forward only', () => {
  const { path } = slidePath([pt(0, 0), pt(4, 0), pt(4, 3)])
  let last = -1
  for (let f = 0; f <= 1; f += 0.1) {
    const p = path(f)
    const along = p.z === 0 ? p.x : 4 + p.z
    assert.ok(along >= last)
    last = along
  }
  assert.ok(path(0.5).x > 0)
})

test('a point without ground gives a null height', () => {
  const { path } = slidePath([pt(0, 0), pt(4, 0, null)])
  assert.equal(path(1).y, null)
})

test('the whole terrain piece under the base is ignored, another piece still stops it', () => {
  const w = new rapier.World({ x: 0, y: -30, z: 0 })
  const fixed = (id) => w.createRigidBody(rapier.RigidBodyDesc.fixed().setUserData({ id }))
  // Piece A: a roof slab (top at y 1) and a duct on it at x 2..3
  const a = fixed('a')
  w.createCollider(rapier.ColliderDesc.cuboid(1.5, 0.5, 2).setTranslation(0, 0.5, 0), a)
  w.createCollider(rapier.ColliderDesc.cuboid(0.5, 0.5, 0.5).setTranslation(2.5, 1.5, 0), a)
  // Piece B: a box at x 6..7 in the path
  w.createCollider(rapier.ColliderDesc.cuboid(0.5, 1.5, 2).setTranslation(6.5, 1.5, 0), fixed('b'))
  w.step()
  const go = (distance) =>
    throwMove(w, rapier, {
      start: { x: 0, z: 0 },
      dir: { x: 1, z: 0 },
      distance,
      radius: 0.5,
      others: [],
    }).moved
  assert.equal(go(5), 5)
  const stopped = go(20)
  assert.ok(stopped > 5.4 && stopped < 6.1, `moved ${stopped}`)
})
