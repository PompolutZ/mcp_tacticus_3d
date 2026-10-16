import test from 'node:test'
import assert from 'node:assert/strict'
import { createCameraOwner } from './cameraOwner.js'

test('keys move the camera when nobody owns it', () => {
  const o = createCameraOwner()
  assert.equal(o.keysMove(true), true)
  assert.equal(o.owner, 'keys')
})

test('a mouse drag blocks the keys until the button is released', () => {
  const o = createCameraOwner()
  assert.equal(o.mouseStart(), true)
  assert.equal(o.keysMove(true), false)
  assert.equal(o.keysMove(true), false)
  o.mouseEnd()
  assert.equal(o.keysMove(true), true)
})

test('held keys block a mouse drag until all keys are released', () => {
  const o = createCameraOwner()
  o.keysMove(true)
  assert.equal(o.mouseStart(), false)
  assert.equal(o.owner, 'keys')
  o.keysMove(false)
  assert.equal(o.owner, null)
  assert.equal(o.mouseStart(), true)
})

test('mouseEnd does not release the keys', () => {
  const o = createCameraOwner()
  o.keysMove(true)
  o.mouseEnd()
  assert.equal(o.owner, 'keys')
})

test('keys still move during a piece drag, also while the mouse owns the camera', () => {
  const o = createCameraOwner()
  o.mouseStart()
  assert.equal(o.keysMove(true, true), true)
  assert.equal(o.owner, 'mouse')
  o.mouseEnd()
  assert.equal(o.owner, null)
})

test('release clears the owner', () => {
  const o = createCameraOwner()
  o.mouseStart()
  o.release()
  assert.equal(o.keysMove(true), true)
})
