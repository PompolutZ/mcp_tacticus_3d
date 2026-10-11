import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ROUND_POINTS, nextRoundSpot } from './board.js'

test('nextRoundSpot: round 1 to 2, round 5 to 6', () => {
  assert.deepEqual(nextRoundSpot(ROUND_POINTS[0]), ROUND_POINTS[1])
  assert.deepEqual(nextRoundSpot(ROUND_POINTS[4]), ROUND_POINTS[5])
})

test('nextRoundSpot: a marker near a spot counts as on it', () => {
  const p = ROUND_POINTS[1]
  assert.deepEqual(nextRoundSpot({ x: p.x + 0.3, z: p.z - 0.3 }), ROUND_POINTS[2])
})

test('nextRoundSpot: round 6 stays', () => {
  assert.deepEqual(nextRoundSpot(ROUND_POINTS[5]), ROUND_POINTS[5])
})

test('nextRoundSpot: a marker off the track gives null', () => {
  assert.equal(nextRoundSpot({ x: 0, z: 0 }), null)
})
