import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clearSight, losLength, terrainSize } from './losLength.js'

// A fake terrain collider: handle, and the Size on its parent body. size undefined: not terrain.
const piece = (handle, size, distance) => ({
  handle,
  distance,
  parent: () => ({ userData: size === undefined ? undefined : { size } }),
})

// A fake cast: the first collider along the line (sorted by distance) that keep accepts
const fakeCast =
  (colliders) =>
  ({ maxDistance, keep }) => {
    const hit = colliders
      .filter((c) => c.distance <= maxDistance && keep(c))
      .sort((a, b) => a.distance - b.distance)[0]
    return hit
      ? { distance: hit.distance, collider: hit }
      : { distance: maxDistance, collider: null }
  }

const run = (colliders, over = {}) =>
  losLength({
    start: { x: 0, z: 0 },
    yaw: 0,
    width: 1,
    blockSize: 2,
    skipped: new Set(),
    cast: fakeCast(colliders),
    ...over,
  })

test('terrain size comes from the body, null for the table', () => {
  assert.equal(terrainSize(piece(1, 3, 0)), 3)
  assert.equal(terrainSize(piece(2, undefined, 0)), null)
})

test('no terrain: the line runs to the mat edge', () => {
  assert.deepEqual(run([]), { distance: 18, blocker: null })
})

test('the mat edge follows the yaw', () => {
  const r = run([], { yaw: Math.PI / 2 })
  assert.ok(Math.abs(r.distance - 18) < 1e-9)
  const d = run([], { yaw: Math.PI, start: { x: 5, z: 0 } })
  assert.ok(Math.abs(d.distance - 23) < 1e-9)
})

test('larger terrain stops the line', () => {
  const big = piece(1, 3, 7)
  const r = run([big])
  assert.equal(r.blocker.collider, big)
  assert.equal(r.blocker.size, 3)
  assert.ok(Math.abs(r.distance - 7) < 0.02)
})

test('same or smaller Size does not stop it', () => {
  assert.equal(run([piece(1, 2, 5), piece(2, 1, 6), piece(3, 0, 7)]).blocker, null)
})

test('the first larger piece stops it, a nearer smaller one does not', () => {
  const far = piece(2, 4, 10)
  const r = run([piece(1, 2, 4), far, piece(3, 5, 14)])
  assert.equal(r.blocker.collider, far)
})

test('terrain the looker stands on is skipped', () => {
  const under = piece(1, 4, 0)
  assert.equal(run([under], { skipped: new Set([1]) }).blocker, null)
  assert.equal(run([under]).blocker.collider, under)
})

test('the table is not terrain', () => {
  assert.equal(run([piece(1, undefined, 3)]).blocker, null)
})

// clearSight with a fake: blocked(seg) comes from a rule on the segment. Counts the calls.
const sight = (rule, over = {}) => {
  const calls = []
  const result = clearSight({
    from: { x: 0, z: 0 },
    fromRadius: 0.5,
    to: { x: 3, z: 0 },
    toRadius: 0.5,
    blocked: (seg) => {
      calls.push(seg)
      return rule(seg)
    },
    ...over,
  })
  return { result, calls }
}
// The z at which a segment crosses x = 1.5
const zAt = ({ start, yaw, maxDistance }) => {
  const dx = Math.cos(yaw)
  return start.z - Math.sin(yaw) * ((1.5 - start.x) / dx) * (maxDistance > 0 ? 1 : 0)
}

test('sight: a clear center line is found first, with one cast', () => {
  const { result, calls } = sight(() => false)
  assert.deepEqual(result, { a: { x: 0, z: 0 }, b: { x: 3, z: 0 } })
  assert.equal(calls.length, 1)
})

test('sight: center blocked, an edge line clear gives that segment', () => {
  // A wall at x = 1.5 covering z from -1 to 0.2: only lines crossing it at z > 0.2 pass
  const { result } = sight((seg) => zAt(seg) <= 0.2)
  assert.ok(result)
  assert.ok(
    zAt({
      start: result.a,
      yaw: Math.atan2(-(result.b.z - result.a.z), result.b.x - result.a.x),
      maxDistance: 1,
    }) > 0.2,
  )
  assert.ok(Math.abs(result.a.x) <= 0.5 && Math.abs(result.b.x - 3) <= 0.5)
})

test('sight: every line blocked gives null', () => {
  assert.equal(sight(() => true).result, null)
})

test('sight: stops at the first clear pair', () => {
  let n = 0
  const { result, calls } = sight(() => ++n < 4)
  assert.ok(result)
  assert.equal(calls.length, 4)
})

test('sight: cast count for 1 inch bases 3 inches apart, all blocked', () => {
  const { calls } = sight(() => true)
  // 17 points per base: 1 center + 17 parallel + 17 * 16 others
  assert.equal(calls.length, 1 + 17 + 17 * 16)
})
