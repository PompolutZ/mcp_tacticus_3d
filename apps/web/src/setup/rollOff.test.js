import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FACES } from '../dice/faces.js'
import { ROLL_OFF_FRESH, hasFreshThrow, readRollOff, shelfSymbols } from './rollOff.js'

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

test('hasFreshThrow: a new throw entry within ROLL_OFF_FRESH counts', () => {
  const now = 100000
  const seen = new Set(['a'])
  assert.equal(hasFreshThrow([{ id: 'b', kind: 'throw', at: now - 1000 }], seen, now), true)
  // seen, too old, not a throw, or no entries
  assert.equal(hasFreshThrow([{ id: 'a', kind: 'throw', at: now - 1000 }], seen, now), false)
  assert.equal(
    hasFreshThrow([{ id: 'b', kind: 'throw', at: now - ROLL_OFF_FRESH }], seen, now),
    false,
  )
  assert.equal(hasFreshThrow([{ id: 'b', kind: 'roll', at: now }], seen, now), false)
  assert.equal(hasFreshThrow([], seen, now), false)
})

const shelf = (n, face = 1) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`d${i}`, { place: 'shelf', face }]))

test('shelfSymbols: symbols of both shelves, null unless both hold 5 dice', () => {
  const symbol = FACES[0].symbol
  const out = shelfSymbols({ host: { dice: shelf(5) }, guest: { dice: shelf(5) } })
  assert.deepEqual(out, { host: Array(5).fill(symbol), guest: Array(5).fill(symbol) })
  assert.equal(shelfSymbols({ host: { dice: shelf(4) }, guest: { dice: shelf(5) } }), null)
  assert.equal(shelfSymbols({ host: { dice: shelf(5) }, guest: { dice: shelf(6) } }), null)
  assert.equal(shelfSymbols({ host: { dice: shelf(5) } }), null)
  assert.equal(shelfSymbols({}), null)
  // dice not on the shelf do not count
  const mixed = { ...shelf(4), x: { place: 'table', face: 1 } }
  assert.equal(shelfSymbols({ host: { dice: mixed }, guest: { dice: shelf(5) } }), null)
})
