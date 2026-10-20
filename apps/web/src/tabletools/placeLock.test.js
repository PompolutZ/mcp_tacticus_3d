import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  endEdgeClamp,
  footprintGap,
  lineClamp,
  nearestTouching,
  placeClamp,
  touches,
} from './placeLock.js'

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

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
// Distance from a to the short end edge of the right half
const edgeDistance = (a) => Math.hypot(a.x - TIP, a.z - clamp(a.z, -HALF, HALF))
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

test('end edge clamp: the result touches the short end edge', () => {
  const probes = [
    { x: 9, z: 0 },
    { x: 5, z: 0.3 },
    { x: 5, z: 4 },
    { x: 1, z: 6 },
    { x: 2, z: -0.2 },
    { x: 3.2, z: -3 },
    { x: 0, z: 0 },
  ]
  for (const p of probes) {
    const r = endEdgeClamp(SHAPE, 'right', TIP, HALF, p, R)
    assert.ok(edgeDistance(r) <= R + 1e-9)
  }
})

test('end edge clamp: a point that already touches is unchanged, also on the tool side', () => {
  for (const p of [
    { x: TIP + R * 0.5, z: 0 },
    { x: TIP - R * 0.5, z: HALF * 0.5 },
    { x: TIP - R * 0.9, z: -HALF },
    { x: TIP + R * 0.3, z: HALF + R * 0.5 },
  ]) {
    assert.deepEqual(endEdgeClamp(SHAPE, 'right', TIP, HALF, p, R), p)
  }
})

test('end edge clamp: no sliding along the long sides beyond the touch', () => {
  // Far along the side: the base goes only to touch the edge corner
  const r = endEdgeClamp(SHAPE, 'right', TIP, HALF, { x: 0, z: 6 }, R)
  near(edgeDistance(r), R)
  near(dist(r, { x: TIP, z: HALF }), R)
  const inside = endEdgeClamp(SHAPE, 'right', TIP, HALF, { x: TIP - 3, z: 0 }, R)
  near(inside.x, TIP - R)
  near(inside.z, 0)
})

test('end edge clamp: nearest to p among the touching centers', () => {
  const p = { x: 6, z: 0.9 }
  const r = endEdgeClamp(SHAPE, 'right', TIP, HALF, p, R)
  for (let x = TIP - 3; x < 9; x += 0.1)
    for (let z = -4; z < 4; z += 0.1) {
      const q = { x, z }
      if (edgeDistance(q) > R) continue
      assert.ok(dist(p, r) <= dist(p, q) + 1e-9)
    }
})

test('end edge clamp: the left half uses its own end', () => {
  const r = endEdgeClamp(SHAPE, 'left', TIP, HALF, { x: -9, z: 0 }, R)
  near(r.x, -(TIP + R))
  near(r.z, 0)
})
