import test from 'node:test'
import assert from 'node:assert/strict'
import { freshItem, FRESH_MS } from './bubble.js'

const item = (type, id, at) => ({ type, entry: { id, at } })
const NOW = 100_000

test('first look shows nothing and remembers the entries', () => {
  const items = [item('log', 'a', NOW), item('dice', 'b', NOW - 10)]
  const { fresh, known } = freshItem(items, null, NOW)
  assert.equal(fresh, null)
  assert.equal(known.size, 2)
})

test('shows the newest entry that was not seen', () => {
  const first = freshItem([item('log', 'a', NOW - 50)], null, NOW)
  const items = [item('dice', 'c', NOW), item('log', 'b', NOW - 10), item('log', 'a', NOW - 50)]
  assert.equal(freshItem(items, first.known, NOW).fresh.entry.id, 'c')
})

test('shows nothing when no entry is new', () => {
  const items = [item('log', 'a', NOW)]
  const first = freshItem(items, null, NOW)
  assert.equal(freshItem(items, first.known, NOW + 1).fresh, null)
})

test('an old new entry (a sync from the other player) shows nothing', () => {
  const first = freshItem([], null, NOW)
  const items = [item('log', 'old', NOW - FRESH_MS - 1)]
  assert.equal(freshItem(items, first.known, NOW).fresh, null)
})

test('a dice entry and a log entry with the same id are two entries', () => {
  const first = freshItem([item('log', 'x', NOW)], null, NOW)
  const items = [item('dice', 'x', NOW), item('log', 'x', NOW)]
  assert.equal(freshItem(items, first.known, NOW).fresh.type, 'dice')
})
