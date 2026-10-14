import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BOARD_HALF_LENGTH,
  BOARD_HALF_WIDTH,
  BOARD_X,
  ROUND_POINTS,
  START_MARKERS,
  VP_MARKER_SIZE,
  VP_POINTS,
  nextRoundSpot,
  scoreFromMarkers,
  snapPoint,
} from './board.js'

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

test('VP markers start inside the board, side by side, off every VP and round spot', () => {
  const { host, guest } = START_MARKERS
  const half = VP_MARKER_SIZE / 2
  for (const m of [host, guest]) {
    assert.ok(Math.abs(m.x - BOARD_X) + half <= BOARD_HALF_WIDTH)
    assert.ok(Math.abs(m.z) + half <= BOARD_HALF_LENGTH)
    assert.equal(snapPoint(VP_POINTS, m.x, m.z), null)
    assert.equal(snapPoint(ROUND_POINTS, m.x, m.z), null)
  }
  assert.equal(host.x, guest.x)
  assert.ok(host.z - guest.z >= VP_MARKER_SIZE)
  // The corner above the "1" box (VP 1 spot): the markers stay on the -x side of its row, left of nothing else
  assert.ok(host.x + half < VP_POINTS[0].x)
})
