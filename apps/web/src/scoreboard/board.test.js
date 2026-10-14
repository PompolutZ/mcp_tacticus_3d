import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ROUND_POINTS, START_MARKERS, VP_POINTS, nextRoundSpot, scoreFromMarkers } from './board.js'

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

test('scoreFromMarkers: start places give 0 VP and round 1', () => {
  assert.deepEqual(scoreFromMarkers(START_MARKERS), { host: 0, guest: 0, round: 1 })
})

test('scoreFromMarkers: VP and round from the spots, a near marker counts as on it', () => {
  const near = { x: VP_POINTS[2].x + 0.3, z: VP_POINTS[2].z }
  const markers = { host: near, guest: VP_POINTS[15], round: ROUND_POINTS[3] }
  assert.deepEqual(scoreFromMarkers(markers), { host: 3, guest: 16, round: 4 })
})

test('scoreFromMarkers: no markers or a marker off the track', () => {
  assert.deepEqual(scoreFromMarkers(null), { host: 0, guest: 0, round: null })
  assert.deepEqual(scoreFromMarkers({ round: { x: 0, z: 0 } }).round, null)
})
