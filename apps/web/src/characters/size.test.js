import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cardSizes, sideSize } from './size.js'

const rows = JSON.parse(readFileSync(new URL('./jarvis-characters.json', import.meta.url), 'utf8'))
const sizes = (slug) => cardSizes(rows.find((c) => c.slug === slug).statCard)

test('size follows the face-up side', () => {
  assert.equal(sideSize(sizes('hulkbuster'), 'healthy'), 4)
  assert.equal(sideSize(sizes('hulkbuster'), 'injured'), 2)
  assert.equal(sideSize(sizes('phoenix'), 'healthy'), 2)
  assert.equal(sideSize(sizes('phoenix'), 'injured'), 4)
})

test('a card with no back side has its front size on both sides', () => {
  const s = cardSizes({ frontSide: { size: '3' }, backSide: null })
  assert.deepEqual(s, { healthy: 3, injured: 3 })
})

test('no size gives 0', () => {
  assert.deepEqual(cardSizes({ frontSide: {}, backSide: null }), { healthy: 0, injured: 0 })
})
