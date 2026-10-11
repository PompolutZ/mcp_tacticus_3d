import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTokenStack, stackTop } from './stack.js'

const crisis = (x, z, top) => ({ x, z, radius: 0.5, top, index: -1 })
const loose = (x, z, top, index, radius = 0.375) => ({ x, z, radius, top, index })

test('nothing under the center: null', () => {
  assert.equal(stackTop(0, 0, Infinity, [crisis(3, 0, 0.1)], [loose(0, 2, 0.1, 0)]), null)
})

test('on a crisis token when the center is inside its circle', () => {
  assert.equal(stackTop(0.4, 0, 5, [crisis(0, 0, 0.1)], []), 0.1)
  assert.equal(stackTop(0.6, 0, 5, [crisis(0, 0, 0.1)], []), null)
})

test('on a loose token that comes earlier, not on one that comes later', () => {
  const list = [loose(0, 0, 0.1, 1)]
  assert.equal(stackTop(0.2, 0, 2, [], list), 0.1)
  assert.equal(stackTop(0.2, 0, 1, [], list), null)
  assert.equal(stackTop(0.2, 0, 0, [], list), null)
})

test('uses the radius of the lower token', () => {
  assert.equal(stackTop(0.45, 0, 5, [], [loose(0, 0, 0.1, 0, 0.5)]), 0.1)
  assert.equal(stackTop(0.45, 0, 5, [], [loose(0, 0, 0.1, 0, 0.375)]), null)
})

test('the highest token wins', () => {
  const c = [crisis(0, 0, 0.1)]
  const l = [loose(0, 0, 0.2, 0), loose(0, 0, 0.3, 1)]
  assert.equal(stackTop(0.1, 0, 5, c, l), 0.3)
  assert.equal(stackTop(0.1, 0, 1, c, l), 0.2)
})

test('registry: put, topAt, remove', () => {
  const s = createTokenStack()
  s.putCrisis('c', 0, 0, 0.5, 0.1)
  s.putLoose('a', 0, 0, 0.375, 0.2, 0)
  s.putLoose('a', 0, 0, 0.375, 0.25, 0)
  assert.equal(s.topAt(0.1, 0), 0.25)
  assert.equal(s.topAt(0.1, 0, 0), 0.1)
  s.removeLoose('a')
  assert.equal(s.topAt(0.1, 0), 0.1)
  s.removeCrisis('c')
  assert.equal(s.topAt(0.1, 0), null)
})
