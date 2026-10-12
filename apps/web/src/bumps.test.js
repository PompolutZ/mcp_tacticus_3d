import test from 'node:test'
import assert from 'node:assert/strict'
import { DIE_BUMP_MAX, DIE_BUMP_MIN, createBumpFinder } from './bumps.js'

const G = 25
const DT = 1 / 120
const still = { x: 0, y: 0, z: 0 }

function finder() {
  return createBumpFinder({ gravity: G })
}

// Feeds a list of velocities and returns the strengths
function run(f, velocities, dt = DT) {
  return velocities.map((v) => f.feed(v, dt))
}

test('the first feed only remembers', () => {
  assert.equal(finder().feed({ x: 0, y: -30, z: 0 }, DT), 0)
})

test('a free fall is no bump', () => {
  const f = finder()
  const out = run(
    f,
    Array.from({ length: 60 }, (_, i) => ({ x: 3, y: -G * DT * i, z: 0 })),
  )
  assert.deepEqual(
    out,
    out.map(() => 0),
  )
})

test('a fall that stops is a loud bump, then silence', () => {
  const f = finder()
  const out = run(f, [{ x: 0, y: -20, z: 0 }, { x: 0, y: -20 - G * DT, z: 0 }, still, still, still])
  assert.equal(out[0], 0)
  assert.equal(out[1], 0)
  assert.ok(out[2] > 0.9)
  assert.deepEqual(out.slice(3), [0, 0])
})

test('a bounce is a bump, a harder one is stronger', () => {
  const soft = finder()
  const hard = finder()
  const s = run(soft, [
    { x: 0, y: -4, z: 0 },
    { x: 0, y: 3, z: 0 },
  ])[1]
  const h = run(hard, [
    { x: 0, y: -12, z: 0 },
    { x: 0, y: 9, z: 0 },
  ])[1]
  assert.ok(s > 0 && h > s && h <= 1)
})

test('a roll on the tray is no bump', () => {
  const f = finder()
  // Held by the floor: vy stays 0, the speed along it falls slowly (damping)
  const out = run(
    f,
    Array.from({ length: 60 }, (_, i) => ({ x: 8 - i * 0.01, y: 0, z: 2 })),
  )
  assert.deepEqual(
    out,
    out.map(() => 0),
  )
})

test('a die at rest is no bump', () => {
  const f = finder()
  assert.deepEqual(run(f, [still, still, still, still]), [0, 0, 0, 0])
})

test('a change under the minimum is no bump, the minimum is not far from a bump', () => {
  const f = finder()
  f.feed(still, DT)
  assert.equal(f.feed({ x: DIE_BUMP_MIN - 0.01, y: 0, z: 0 }, DT), 0)
  const g = finder()
  g.feed(still, DT)
  assert.ok(g.feed({ x: DIE_BUMP_MIN + 0.5, y: 0, z: 0 }, DT) > 0)
})

test('the strength is 1 at the maximum and above', () => {
  const f = finder()
  f.feed(still, DT)
  assert.equal(f.feed({ x: DIE_BUMP_MAX, y: 0, z: 0 }, DT), 1)
  f.feed(still, DT)
  assert.equal(f.feed({ x: 100, y: 0, z: 0 }, DT), 1)
})

test('a sideways hit counts too', () => {
  const f = finder()
  f.feed({ x: 10, y: 0, z: 0 }, DT)
  assert.ok(f.feed({ x: -10, y: 0, z: 0 }, DT) > 0.9)
})

test('the gravity part follows dt', () => {
  // A fall of -5 in/s: no bump after 0.2 s of gravity 25, a bump after 1/120 s
  const slow = finder()
  slow.feed(still, 0.2)
  assert.equal(slow.feed({ x: 0, y: -5, z: 0 }, 0.2), 0)
  const fast = finder()
  fast.feed(still, DT)
  assert.ok(fast.feed({ x: 0, y: -5, z: 0 }, DT) > 0)
})

test('reset: the next feed is never a bump', () => {
  const f = finder()
  f.feed({ x: 0, y: -20, z: 0 }, DT)
  f.reset()
  assert.equal(f.feed(still, DT), 0)
  // and it works again afterwards
  assert.ok(f.feed({ x: 15, y: 0, z: 0 }, DT) > 0.5)
})

test('a velocity that is not finite or a dt that is not positive resets', () => {
  const f = finder()
  f.feed({ x: 0, y: -20, z: 0 }, DT)
  assert.equal(f.feed({ x: NaN, y: 0, z: 0 }, DT), 0)
  assert.equal(f.feed(still, DT), 0)
  f.feed({ x: 0, y: -20, z: 0 }, DT)
  assert.equal(f.feed(still, 0), 0)
  assert.equal(f.feed(still, DT), 0)
})
