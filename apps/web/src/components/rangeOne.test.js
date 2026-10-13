import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampRange, rangeReach, withinRange } from './rangeOne.js'

const C = { x: 2, z: 1 }
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`)

test('reach is the radii and the range', () => {
  near(rangeReach(0.7, 1, 0.5), 2.2)
})

test('a far point is cut to full range 1, in its direction', () => {
  const r = clampRange(C, { x: 12, z: 1 }, 3)
  near(r.x, 5)
  near(r.z, 1)
})

test('a near point stays, also the center of the snapped piece', () => {
  assert.deepEqual(clampRange(C, { x: 2, z: 2.5 }, 3), { x: 2, z: 2.5 })
  assert.deepEqual(clampRange(C, C, 3), { x: 2, z: 1 })
})

test('any direction is cut to full reach', () => {
  for (let a = 0; a < 2 * Math.PI; a += 0.7) {
    const p = { x: C.x + 9 * Math.cos(a), z: C.z + 9 * Math.sin(a) }
    const r = clampRange(C, p, 3)
    near(Math.hypot(r.x - C.x, r.z - C.z), 3)
    near(r.x - C.x, 3 * Math.cos(a))
    near(r.z - C.z, 3 * Math.sin(a))
  }
})

test('within range: inside and at full reach, not beyond', () => {
  assert.ok(withinRange(C, { x: 4, z: 1 }, 3))
  assert.ok(withinRange(C, { x: 5, z: 1 }, 3))
  assert.ok(!withinRange(C, { x: 5.5, z: 1 }, 3))
})
