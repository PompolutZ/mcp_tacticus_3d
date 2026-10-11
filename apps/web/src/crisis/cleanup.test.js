import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cleanupCrisisTokens } from './cleanup.js'

const cards = JSON.parse(readFileSync(new URL('./cards.json', import.meta.url), 'utf8'))
const cardOf = (key) => cards[key] ?? null

const JAIL = 'jailbreak-leads-to-mass-mutant-escape'
const source = (id, up) => ({
  id,
  cardKey: JAIL,
  frontKey: 'extract-unexhausted-source',
  backKey: 'extract-exhausted-source',
  up,
})
const supply = (id, heldBy) => ({
  id,
  cardKey: JAIL,
  frontKey: 'extract-source-civilian',
  backKey: null,
  up: 'front',
  heldBy,
})

test('the Jailbreak card is a Source card with a supply', () => {
  assert.equal(cards[JAIL].supply, 'extract-source-civilian')
  assert.ok(cards[JAIL].tokens.every((t) => t.flipOnly))
})

test('Exhausted Source turns to its front, Unexhausted stays the same object', () => {
  const back = source('s1', 'back')
  const front = source('s2', 'front')
  const out = cleanupCrisisTokens([back, front], cardOf)
  assert.equal(out[0].up, 'front')
  assert.equal(out[0].id, 's1')
  assert.equal(out[1], front)
})

test('supply tokens go, held and on the table', () => {
  const out = cleanupCrisisTokens([supply('p1'), supply('p2', 'c1'), source('s1', 'back')], cardOf)
  assert.deepEqual(
    out.map((t) => t.id),
    ['s1'],
  )
})

test('other crisis tokens do not change', () => {
  const other = { id: 'o1', cardKey: 'no-such-card', frontKey: 'x', backKey: null, up: 'back' }
  const noSupply = { id: 'o2', cardKey: JAIL, frontKey: 'something-else', up: 'back' }
  const out = cleanupCrisisTokens([other, noSupply], cardOf)
  assert.equal(out[0], other)
  assert.equal(out[1], noSupply)
})
