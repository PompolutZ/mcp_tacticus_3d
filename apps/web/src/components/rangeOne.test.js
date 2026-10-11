import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lockPoint, lockYaw } from './rangeOne.js'

const C = { x: 2, z: 1 }
const LAST = { x: 0, z: 1 }
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`)

test('a far point is cut to full range 1, in its direction', () => {
  const r = lockPoint(C, { x: 12, z: 1 }, 3, LAST)
  near(r.x, 5)
  near(r.z, 1)
  near(r.dir.x, 1)
})

test('a near point stays', () => {
  const r = lockPoint(C, { x: 2, z: 2.5 }, 3, LAST)
  near(r.x, 2)
  near(r.z, 2.5)
})

test('a point at the center keeps the last direction', () => {
  const r = lockPoint(C, { x: 2, z: 1 }, 3, LAST)
  near(r.x, 2)
  near(r.z, 1)
  assert.deepEqual(r.dir, LAST)
})

test('any direction works', () => {
  for (let a = 0; a < 2 * Math.PI; a += 0.7) {
    const p = { x: C.x + 9 * Math.cos(a), z: C.z + 9 * Math.sin(a) }
    const r = lockPoint(C, p, 3, LAST)
    near(Math.hypot(r.x - C.x, r.z - C.z), 3)
    near(r.dir.x, Math.cos(a))
    near(r.dir.z, Math.sin(a))
  }
})

test('the tool yaw puts the character on the short-side line', () => {
  for (const across of [1, -1]) {
    for (let a = 0; a < 2 * Math.PI; a += 0.7) {
      const dir = { x: Math.cos(a), z: Math.sin(a) }
      const yaw = lockYaw(dir, across)
      // local -across·Z in table XZ
      near(-across * Math.sin(yaw), dir.x)
      near(-across * Math.cos(yaw), dir.z)
    }
  }
})
