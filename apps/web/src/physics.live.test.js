import { test } from 'node:test'
import assert from 'node:assert/strict'
import { liveBody } from './physics.js'

function fakeWorld(...bodies) {
  return { getRigidBody: (h) => bodies.find((b) => b.handle === h) ?? null }
}

test('liveBody: body in the world', () => {
  const rb = { handle: 1 }
  assert.equal(liveBody(fakeWorld(rb), rb), true)
})

test('liveBody: removed body', () => {
  const rb = { handle: 1 }
  assert.equal(liveBody(fakeWorld(), rb), false)
})

test('liveBody: handle reused by another body', () => {
  const old = { handle: 1 }
  assert.equal(liveBody(fakeWorld({ handle: 1 }), old), false)
})

test('liveBody: null body or world', () => {
  assert.equal(liveBody(fakeWorld(), null), false)
  assert.equal(liveBody(fakeWorld(), undefined), false)
  assert.equal(liveBody(null, { handle: 1 }), false)
})
