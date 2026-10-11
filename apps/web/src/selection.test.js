import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toolSelects } from './selection.js'

const characters = [
  { id: 'c1', teamColor: 'blue' },
  { id: 'c2', teamColor: 'red' },
]
const model = (id) => ({ kind: 'character', id })

test('a tool selects a model of a played side', () => {
  assert.equal(toolSelects(model('c1'), characters, ['blue']), true)
})

test('a tool does not select a model of a side not played', () => {
  assert.equal(toolSelects(model('c2'), characters, ['blue']), false)
})

test('the second model of a character counts for its character', () => {
  assert.equal(toolSelects(model('c1:2'), characters, ['blue']), true)
  assert.equal(toolSelects(model('c2:2'), characters, ['blue']), false)
})

test('a tool selects a crisis token', () => {
  assert.equal(toolSelects({ kind: 'token', id: 't1' }, characters, ['blue']), true)
})

test('in single player both sides are played', () => {
  assert.equal(toolSelects(model('c2'), characters, ['blue', 'red']), true)
})
