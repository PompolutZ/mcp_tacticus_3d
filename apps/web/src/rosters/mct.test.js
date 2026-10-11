import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRoster } from './mct.js'

const KINDS = { 11111111: 'character', 22222222: 'tactic', 33333333: 'gem', 44444444: 'secure' }
const kindOf = (code) => KINDS[code] ?? null

test('a gem behind a character is kept in gems', () => {
  const parsed = parseRoster('11111111-33333333,22222222', kindOf)
  assert.deepEqual(parsed.characters, [{ code: '11111111', gems: ['33333333'] }])
  assert.deepEqual(parsed.tactics, ['22222222'])
})

test('a gem alone is not a Team Tactic card', () => {
  const parsed = parseRoster('11111111,33333333', kindOf)
  assert.deepEqual(parsed.tactics, [])
  assert.deepEqual(parsed.unknown, ['33333333'])
})

test('a Team Tactic card behind a character is unknown', () => {
  const parsed = parseRoster('11111111-22222222', kindOf)
  assert.deepEqual(parsed.characters[0].gems, [])
  assert.deepEqual(parsed.unknown, ['22222222'])
})
