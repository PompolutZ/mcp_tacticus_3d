import { test } from 'node:test'
import assert from 'node:assert/strict'
import { losBlock, standingTerrainSize } from './losBlock.js'

test('standing on the table adds no Size', () => {
  assert.equal(standingTerrainSize([]), 0)
  assert.equal(standingTerrainSize([null]), 0)
})

test('the largest terrain under the base counts', () => {
  assert.equal(standingTerrainSize([null, 2, 1]), 2)
})

test('the block Size is the character Size plus its terrain, with the target name', () => {
  assert.deepEqual(losBlock({ size: 3, terrain: 0, name: 'Hulk', own: false }), {
    size: 3,
    label: 'Size 3 · Hulk',
  })
  assert.deepEqual(losBlock({ size: 2, terrain: 1, name: 'Hulk', own: false }), {
    size: 3,
    label: 'Size 3 · Hulk',
  })
})

test('with no target the label says own', () => {
  assert.deepEqual(losBlock({ size: 2, terrain: 0, name: 'Cap', own: true }), {
    size: 2,
    label: 'Size 2 · own',
  })
})
