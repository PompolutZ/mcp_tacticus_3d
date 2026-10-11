import { test } from 'node:test'
import assert from 'node:assert/strict'
import { terrainLabel } from './label.js'

test('label with a Size and the lock state', () => {
  assert.equal(terrainLabel('Tree', 2, true), 'Tree - Size 2 - (L)ocked')
  assert.equal(terrainLabel('Tree', 2, false), 'Tree - Size 2 - Un(L)ocked')
})

test('label without a Size', () => {
  assert.equal(terrainLabel('Tree', undefined, true), 'Tree - (L)ocked')
  assert.equal(terrainLabel('Tree', undefined, false), 'Tree - Un(L)ocked')
})
