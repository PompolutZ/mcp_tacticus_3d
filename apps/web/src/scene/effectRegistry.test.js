import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasAll, withEffect } from './effectRegistry.js'

test('withEffect sets, replaces and removes', () => {
  const a = {}
  const b = {}
  let map = withEffect({}, 'x', a)
  assert.equal(map.x, a)
  assert.equal(withEffect(map, 'x', a), map)
  map = withEffect(map, 'x', b)
  assert.equal(map.x, b)
  map = withEffect(map, 'x', null)
  assert.deepEqual(map, {})
  assert.equal(withEffect(map, 'x', null), map)
})

test('hasAll needs every mode', () => {
  assert.equal(hasAll({ a: {} }, ['a', 'b']), false)
  assert.equal(hasAll({ a: {}, b: {} }, ['a', 'b']), true)
})
