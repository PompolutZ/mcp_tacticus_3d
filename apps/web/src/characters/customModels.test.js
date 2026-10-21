import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isCustomModel } from './customModels.js'

const list = { hero: { 'characters/hero/model.glb': 'photos-to-glb, set 1' } }

test('a listed file is a custom model', () => {
  assert.equal(isCustomModel(list, 'hero', 'characters/hero/model.glb'), true)
})

test('an unlisted file or character is not', () => {
  assert.equal(isCustomModel(list, 'hero', 'characters/hero/card-healthy.webp'), false)
  assert.equal(isCustomModel(list, 'other', 'characters/hero/model.glb'), false)
  assert.equal(isCustomModel({}, 'hero', 'characters/hero/model.glb'), false)
})
