import test from 'node:test'
import assert from 'node:assert/strict'
import { createReleaseSnap } from './releaseSnap.js'

const A = { id: 'a' }
const B = { id: 'b' }

test('no snap while the drag goes on, also over models', () => {
  const s = createReleaseSnap()
  s.move(null)
  s.move(A)
  s.move(B)
  // The only output is at the release; moves return nothing
  assert.equal(s.move(A), undefined)
})

test('snaps at the release over a model', () => {
  const s = createReleaseSnap()
  s.move(null)
  s.move(A)
  s.move(B)
  assert.equal(s.release(), B)
})

test('no snap at the release over no model', () => {
  const s = createReleaseSnap()
  s.move(null)
  s.move(A)
  s.move(null)
  assert.equal(s.release(), null)
})

test('no snap when the drag started on a model and the pointer never left it', () => {
  const s = createReleaseSnap()
  s.move(A)
  s.move(A)
  assert.equal(s.release(), null)
})

test('snaps to the start model after the pointer left it', () => {
  const s = createReleaseSnap()
  s.move(A)
  s.move(null)
  s.move(A)
  assert.equal(s.release(), A)
})

test('snaps to another model than the start model', () => {
  const s = createReleaseSnap()
  s.move(A)
  s.move(B)
  assert.equal(s.release(), B)
})

test('no snap without a pointer move', () => {
  assert.equal(createReleaseSnap().release(), null)
})
