import { test } from 'node:test'
import assert from 'node:assert/strict'
import { teamTactics } from './teamTactics.js'
import { tacticSlotPosition } from '../tactics/layout.js'

const nameOf = (key) => `Name ${key}`
const card = (id, team, index, up = 'face') => ({
  id,
  key: id,
  team,
  up,
  ...tacticSlotPosition(team, index),
})

test('Only the cards of that team show', () => {
  const cards = [card('a', 'host', 0), card('b', 'guest', 0), card('c', 'host', 1)]
  assert.deepEqual(
    teamTactics(cards, 'host', nameOf).items.map((i) => i.id),
    ['a', 'c'],
  )
  assert.equal(teamTactics(cards, 'guest', nameOf).total, 1)
})

test('Order follows the slots from the owner left, for both teams', () => {
  for (const team of ['host', 'guest']) {
    const cards = [card('d', team, 3), card('a', team, 0), card('f', team, 5), card('c', team, 2)]
    assert.deepEqual(
      teamTactics(cards, team, nameOf).items.map((i) => i.id),
      ['a', 'c', 'd', 'f'],
    )
  }
})

test('Used is the flipped cards; used never exceeds the total', () => {
  const cards = [
    card('a', 'host', 0, 'back'),
    card('b', 'host', 1),
    card('c', 'host', 2, 'back'),
    card('d', 'host', 5),
  ]
  const result = teamTactics(cards, 'host', nameOf)
  assert.equal(result.total, 4)
  assert.equal(result.used, 2)
  assert.ok(result.used <= result.total)
  assert.deepEqual(
    result.items.map((i) => i.used),
    [true, false, true, false],
  )
})

test('No cards: empty list', () => {
  assert.deepEqual(teamTactics([], 'host', nameOf), { items: [], used: 0, total: 0 })
})
