import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanupStatus, cleanupText, powerPhaseText } from './phases.js'

const names = { a: 'Alpha', b: 'Beta' }
const nameOf = (key) => names[key]
const poses = { a1: { x: 0, z: 0 }, b1: { x: 1, z: 1 } }
const ch = (id, key, tokens) => ({ id, key, team: 'blue', tokens })

test('cleanupStatus: no character on the board', () => {
  const s = cleanupStatus([], {}, nameOf)
  assert.equal(s.empty, true)
  assert.equal(s.disabled, true)
  assert.equal(s.title, 'Cleanup Phase: no character is on the board.')
})

test('cleanupStatus: blocked names the characters', () => {
  const s = cleanupStatus([ch('a1', 'a', {}), ch('b1', 'b', { activated: 1 })], poses, nameOf)
  assert.equal(s.empty, false)
  assert.equal(s.disabled, true)
  assert.deepEqual(
    s.blocked.map((c) => c.key),
    ['a'],
  )
  assert.equal(s.title, 'Each character on the board needs an Activated or Dazed token: Alpha.')
})

test('cleanupStatus: ready', () => {
  const s = cleanupStatus(
    [ch('a1', 'a', { activated: 1 }), ch('b1', 'b', { dazed: 1 })],
    poses,
    nameOf,
  )
  assert.equal(s.disabled, false)
  assert.equal(s.blocked.length, 0)
  assert.equal(s.title, 'Cleanup Phase for both players. Score VP first.')
})

test('powerPhaseText', () => {
  const gains = [
    { name: 'Alpha', from: 1, to: 2 },
    { name: 'Beta', from: 0, to: 1 },
  ]
  const color = (side) => `c-${side}`
  assert.equal(
    powerPhaseText(gains, ['blue'], color),
    'Power Phase (c-blue): Alpha 1 → 2, Beta 0 → 1',
  )
  assert.equal(
    powerPhaseText(gains, ['blue', 'red'], color),
    'Power Phase: Alpha 1 → 2, Beta 0 → 1',
  )
  assert.equal(
    powerPhaseText([], ['red'], color),
    'Power Phase (c-red): none of your characters is on the board',
  )
  assert.equal(
    powerPhaseText([], ['blue', 'red'], () => assert.fail('no color for two sides')),
    'Power Phase: none of your characters is on the board',
  )
})

test('cleanupText', () => {
  assert.equal(cleanupText(3, [], ''), 'Cleanup Phase: round 3.')
  assert.equal(
    cleanupText(3, ['Alpha', 'Beta'], ''),
    'Cleanup Phase: round 3. Flipped: Alpha, Beta.',
  )
  assert.equal(
    cleanupText(null, [], 'Blue keeps Priority.'),
    'Cleanup Phase: the round marker is not on the round track, so it did not move. Blue keeps Priority.',
  )
  assert.equal(cleanupText(2, ['Alpha'], 'N.'), 'Cleanup Phase: round 2. Flipped: Alpha. N.')
})
