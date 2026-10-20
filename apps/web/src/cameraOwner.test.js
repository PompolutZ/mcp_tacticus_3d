import test from 'node:test'
import assert from 'node:assert/strict'
import { createCameraOwner, keysBlockMouse } from './cameraOwner.js'

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

test('a mouse drag during a glide wins', () => {
  const o = createCameraOwner()
  o.keysMove(true)
  // key released, the camera still glides: active stays true
  assert.equal(o.keysMove(true), true)
  assert.equal(o.mouseStart(false), true)
  assert.equal(o.owner, 'mouse')
  assert.equal(o.keysMove(true), false)
})

test('the keys keep the camera during a glide until the velocity is 0', () => {
  const o = createCameraOwner()
  o.keysMove(true)
  o.keysMove(true)
  assert.equal(o.owner, 'keys')
  o.keysMove(false)
  assert.equal(o.owner, null)
})

test('together: keys and mouse both move, in any order', () => {
  const o = createCameraOwner()
  o.setTogether(true)
  assert.equal(o.keysMove(true), true)
  assert.equal(o.mouseStart(true), true)
  assert.equal(o.keysMove(true), true)
  o.mouseEnd()
  assert.equal(o.keysMove(true), true)
  assert.equal(o.keysMove(false), false)
})

test('together: the mouse does not stop the keys', () => {
  const o = createCameraOwner()
  o.setTogether(true)
  o.mouseStart(false)
  assert.equal(o.keysMove(true), true)
})

test('switching to together drops a key owner; switching back blocks again', () => {
  const o = createCameraOwner()
  o.keysMove(true)
  assert.equal(o.mouseStart(true), false)
  o.setTogether(true)
  assert.equal(o.owner, null)
  assert.equal(o.mouseStart(true), true)
  o.mouseEnd()
  o.setTogether(false)
  o.keysMove(true)
  assert.equal(o.mouseStart(true), false)
})

test('keys turn the mouse drag off only when not together', () => {
  assert.equal(keysBlockMouse('keys', true, false), true)
  assert.equal(keysBlockMouse('keys', true, true), false)
  assert.equal(keysBlockMouse('mouse', true, false), false)
  assert.equal(keysBlockMouse('keys', false, false), false)
})
