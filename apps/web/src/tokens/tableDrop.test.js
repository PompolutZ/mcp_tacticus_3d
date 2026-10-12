import test from 'node:test'
import assert from 'node:assert/strict'
import { isTableDrop, tokenKeyParts } from './tableDrop.js'

test('the key of a token names its list', () => {
  assert.deepEqual(tokenKeyParts('token:a'), { list: 'tokens', id: 'a' })
  assert.deepEqual(tokenKeyParts('loose:b:c'), { list: 'looseTokens', id: 'b:c' })
  assert.deepEqual(tokenKeyParts('pile:d'), { list: 'tokenPiles', id: 'd' })
  assert.equal(tokenKeyParts('tactic:e'), null)
  assert.equal(tokenKeyParts('model:f'), null)
  assert.equal(tokenKeyParts('nocolon'), null)
})

test('a moved piece is a drop on the table', () => {
  assert.equal(isTableDrop({ x: 1, z: 2 }, { x: 3, z: 2 }), true)
  assert.equal(isTableDrop({ x: 1, z: 2 }, { x: 1, z: 4 }), true)
})

test('a new piece is a drop on the table', () => {
  assert.equal(isTableDrop(undefined, { x: 1, z: 2 }), true)
})

test('a cancel, a removed piece and a hold are not', () => {
  assert.equal(isTableDrop({ x: 1, z: 2 }, { x: 1, z: 2 }), false)
  assert.equal(isTableDrop({ x: 1, z: 2 }, undefined), false)
  assert.equal(isTableDrop(undefined, { x: 1, z: 2, heldBy: 'c1' }), false)
  assert.equal(isTableDrop({ x: 1, z: 2 }, { x: 5, z: 2, heldBy: 'c1' }), false)
})
