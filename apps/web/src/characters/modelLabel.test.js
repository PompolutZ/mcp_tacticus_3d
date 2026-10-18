import { test } from 'node:test'
import assert from 'node:assert/strict'
import { modelLabel } from './modelLabel.js'

const character = { secondForm: 'diamond' }

test('a model of the first card shows the character name', () => {
  assert.equal(modelLabel({ card: 1, character }, 'Emma Frost'), 'Emma Frost')
})

test('a spare model shows the character name', () => {
  assert.equal(modelLabel({ card: null, character }, 'Emma Frost'), 'Emma Frost')
})

test('a model of the second card shows its form', () => {
  assert.equal(modelLabel({ card: 2, character }, 'Emma Frost'), 'Emma Frost (Diamond)')
})

test('a second card with no form name shows the character name', () => {
  assert.equal(modelLabel({ card: 2, character: { secondForm: null } }, 'Ant-Man'), 'Ant-Man')
})
