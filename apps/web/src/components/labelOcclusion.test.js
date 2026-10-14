import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkDue, pointMoved, rayToAnchor, turned } from './labelOcclusion.js'

test('pointMoved ignores a tiny move', () => {
  assert.equal(pointMoved({ x: 0, y: 0, z: 0 }, { x: 0.0001, y: 0, z: 0 }), false)
  assert.equal(pointMoved({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0.5 }), true)
})

test('turned: same rotation, same rotation negated, and a real turn', () => {
  const q = { x: 0, y: 0, z: 0, w: 1 }
  assert.equal(turned(q, q), false)
  assert.equal(turned(q, { x: 0, y: 0, z: 0, w: -1 }), false)
  assert.equal(turned(q, { x: 0, y: Math.sin(0.05), z: 0, w: Math.cos(0.05) }), true)
})

test('checkDue: throttled, and needs a reason', () => {
  const base = { now: 1, last: 0.95, cameraMoved: true }
  assert.equal(checkDue(base), false)
  assert.equal(checkDue({ ...base, last: 0.8 }), true)
  assert.equal(checkDue({ now: 1, last: 0, cameraMoved: false, dirty: false }), false)
  assert.equal(checkDue({ now: 1, last: 0, dirty: true }), true)
  assert.equal(checkDue({ now: 1, last: 0, anchorMoved: true }), true)
})

test('rayToAnchor: unit direction, stops before the anchor, reuses out', () => {
  const out = { origin: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: 0, z: 0 }, maxToi: 0 }
  assert.equal(rayToAnchor({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 13 }, out), true)
  assert.deepEqual(out.origin, { x: 1, y: 2, z: 3 })
  assert.deepEqual(out.dir, { x: 0, y: 0, z: 1 })
  assert.ok(Math.abs(out.maxToi - 9.9) < 1e-9)
})

test('rayToAnchor: anchor at the camera gives no ray and leaves out alone', () => {
  const out = { origin: { x: 9, y: 9, z: 9 }, dir: { x: 1, y: 0, z: 0 }, maxToi: 5 }
  assert.equal(rayToAnchor({ x: 0, y: 0, z: 0 }, { x: 0, y: 0.05, z: 0 }, out), false)
  assert.equal(out.maxToi, 5)
})
