import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readRollOff } from './rollOff.js'

const win = (host, guest) => readRollOff({ host, guest })

test('more successes wins; Blank, Block and Skull do not count', () => {
  const r = win(['hit', 'hit', 'hit', 'hit', 'blank'], ['hit', 'hit', 'hit', 'block', 'skull'])
  assert.equal(r.winner, 'host')
  assert.deepEqual(r.counts.host, { successes: 4, crits: 0, wilds: 0 })
  assert.equal(r.counts.guest.successes, 3)
  assert.equal(win(['blank', 'block', 'skull'], ['hit']).winner, 'guest')
})

test('equal successes: more Crits wins', () => {
  assert.equal(win(['crit', 'hit'], ['wild', 'hit']).winner, 'host')
  assert.equal(win(['hit', 'hit'], ['crit', 'hit']).winner, 'guest')
})

test('equal successes and Crits: more Wilds wins', () => {
  assert.equal(win(['wild', 'wild', 'crit'], ['wild', 'hit', 'crit']).winner, 'host')
})

test('tie', () => {
  const r = win(['crit', 'wild', 'hit', 'block'], ['hit', 'wild', 'crit', 'skull'])
  assert.equal(r.winner, null)
  assert.equal(win([], []).winner, null)
})
