import { test } from 'node:test'
import assert from 'node:assert/strict'
import { footprintGap, lineClamp, nearestTouching, placeClamp, touches } from './placeLock.js'

// Straight tool: center at the origin, right half along +X (yaw 0), left half along -X (yaw PI)
const SHAPE = { x: 0, z: 0, right: 0, left: Math.PI }
const TIP = 3,
  HALF = 0.5,
  R = 0.7
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`)

test('a base on the outline touches', () => {
  assert.ok(touches(SHAPE, TIP, HALF, { x: 1, z: HALF + R }, R))
  assert.ok(touches(SHAPE, TIP, HALF, { x: 1, z: 0 }, R))
})

test('a base off the outline does not touch', () => {
  assert.ok(!touches(SHAPE, TIP, HALF, { x: 1, z: HALF + R + 0.5 }, R))
  assert.ok(footprintGap(SHAPE, TIP, HALF, { x: 8, z: 0 }, R) > 0)
})

test('a touching point stays', () => {
  const p = { x: 1, z: 0.9 }
  assert.equal(placeClamp(SHAPE, TIP, HALF, p, R), p)
})

test('a far point is cut to the nearest touching point', () => {
  const r = nearestTouching(SHAPE, TIP, HALF, { x: 1, z: 6 }, R)
  near(r.x, 1)
  near(r.z, HALF + R)
  const e = nearestTouching(SHAPE, TIP, HALF, { x: 9, z: 0 }, R)
  near(e.x, TIP + R)
  near(e.z, 0)
})

test('a point is cut onto the line, between start and length', () => {
  const start = { x: 1, z: 1 },
    dir = { x: 1, z: 0 }
  const mid = lineClamp(start, dir, 4, { x: 3, z: 5 })
  near(mid.x, 3)
  near(mid.z, 1)
  const before = lineClamp(start, dir, 4, { x: -2, z: 0 })
  near(before.x, 1)
  const after = lineClamp(start, dir, 4, { x: 9, z: 0 })
  near(after.x, 5)
  near(lineClamp(start, dir, -1, { x: 9, z: 0 }).x, 1)
})
