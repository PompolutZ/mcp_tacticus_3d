import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasModelFile } from './figure.mjs'

const file = 'characters/x/model.glb'

test('a model from the mod counts', () => {
  assert.equal(hasModelFile({ [file]: 'url' }, {}, 'x', file), true)
})

test('a listed custom model counts when the mod has no model', () => {
  assert.equal(hasModelFile({}, { x: { [file]: { command: 'c' } } }, 'x', file), true)
})

test('no mod model and no listed model: standee', () => {
  assert.equal(hasModelFile({}, {}, 'x', file), false)
  assert.equal(hasModelFile({}, { y: { [file]: {} } }, 'x', file), false)
})
