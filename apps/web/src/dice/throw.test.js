import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SPIN_LIMIT, addedSpin, randomSpin, throwLinvel } from './throw.js'

// Seeded random source (mulberry32), so the tests repeat.
function seeded(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
}

const len = (v) => Math.hypot(v.x, v.y, v.z)

test('first throw spin is 15-35 rad/s', () => {
  const random = seeded(1)
  for (let i = 0; i < 500; i++) {
    const l = len(randomSpin(random))
    assert.ok(l >= 15 - 1e-9 && l <= 35 + 1e-9, `spin ${l}`)
  }
})

test('added spin from rest has length 5-10', () => {
  const random = seeded(2)
  for (let i = 0; i < 500; i++) {
    const l = len(addedSpin({ x: 0, y: 0, z: 0 }, random))
    assert.ok(l >= 5 - 1e-9 && l <= 10 + 1e-9, `add ${l}`)
  }
})

test('added spin differs from current by 5-10 when under the cap', () => {
  const random = seeded(3)
  const cur = { x: 10, y: -5, z: 3 }
  for (let i = 0; i < 500; i++) {
    const s = addedSpin(cur, random)
    const d = len({ x: s.x - cur.x, y: s.y - cur.y, z: s.z - cur.z })
    assert.ok(d >= 5 - 1e-9 && d <= 10 + 1e-9, `delta ${d}`)
  }
})

test('added spin is capped at SPIN_LIMIT', () => {
  const random = seeded(4)
  for (let i = 0; i < 500; i++) {
    const l = len(addedSpin({ x: 49, y: 0, z: 0 }, random))
    assert.ok(l <= SPIN_LIMIT + 1e-9, `spin ${l}`)
  }
  // axis +x (z 0, theta 0), length 7.5: 57.5 is cut to 50
  const values = [0.5, 0, 0.5]
  const spin = addedSpin({ x: 50, y: 0, z: 0 }, () => values.shift())
  assert.ok(Math.abs(len(spin) - SPIN_LIMIT) < 1e-9)
})

test('added spin axis is random: directions differ and cover both signs', () => {
  const random = seeded(5)
  const xs = []
  for (let i = 0; i < 200; i++) xs.push(addedSpin({ x: 0, y: 0, z: 0 }, random).x)
  assert.ok(xs.some((x) => x > 1) && xs.some((x) => x < -1))
  assert.ok(new Set(xs.map((x) => x.toFixed(3))).size > 150)
})

test('throwLinvel: up speed 11-19.5 and aims toward the target', () => {
  const random = seeded(6)
  for (let i = 0; i < 200; i++) {
    const v = throwLinvel({ x: 0, y: 2, z: 0 }, { x: 4, y: 0, z: -3 }, random)
    assert.ok(v.y >= 11 && v.y <= 19.5)
    assert.ok(v.x > 0 && v.z < 0)
  }
})
