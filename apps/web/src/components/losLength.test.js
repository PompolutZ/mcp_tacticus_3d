import { test } from 'node:test'
import assert from 'node:assert/strict'
import { losLength, terrainSize } from './losLength.js'

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
