import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isToolPiece, presenceSelection, selectPiece, toolSelects } from './selection.js'

const characters = [
  { id: 'c1', team: 'host' },
  { id: 'c2', team: 'guest' },
]
const model = (id) => ({ kind: 'character', id })

test('a tool selects a model of a played side', () => {
  assert.equal(toolSelects(model('c1'), characters, ['host']), true)
})

test('a tool does not select a model of a side not played', () => {
  assert.equal(toolSelects(model('c2'), characters, ['host']), false)
})

test('the second model of a character counts for its character', () => {
  assert.equal(toolSelects(model('c1:2'), characters, ['host']), true)
  assert.equal(toolSelects(model('c2:2'), characters, ['host']), false)
})

test('a tool selects a crisis token', () => {
  assert.equal(toolSelects({ kind: 'token', id: 't1' }, characters, ['host']), true)
})

test('in single player both sides are played', () => {
  assert.equal(toolSelects(model('c2'), characters, ['host', 'guest']), true)
})

test('a loose token is a tool piece, terrain is not', () => {
  assert.equal(isToolPiece({ kind: 'loose', id: 'l1' }), true)
  assert.equal(isToolPiece({ kind: 'terrain', id: 'x' }), false)
})

test('a loose token and a crisis token with one id are two pieces', () => {
  const sel = selectPiece(selectPiece([], { kind: 'token', id: 'a' }), { kind: 'loose', id: 'a' })
  assert.equal(sel.length, 2)
  assert.deepEqual(presenceSelection(sel), ['token:a', 'loose:a'])
})

test('a tool selects a loose token', () => {
  assert.equal(toolSelects({ kind: 'loose', id: 'l1' }, characters, ['host']), true)
})
