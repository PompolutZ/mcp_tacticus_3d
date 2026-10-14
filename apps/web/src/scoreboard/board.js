// Scoring board geometry: where the board and its markers sit on the table, and the spots of the VP track
// and the round track. Plain module, no React, the same as table.js. See docs/features/crisis.md,
// "Scoring board".
//
// The values come from the mod (3036795456) objects "Tracker" (the board), "Round Tracker", "Red Player VP
// Tracker" and "Blue Player VP tracker", read on 2026-10-03. TTS positions convert to the app with z → -z
// (Terrain.jsx). So TTS +z, the TTS Blue seat, is the app guest side: a TTS object of the Red seat belongs to
// the app's host player (see docs/features/crisis.md, "Setup flow").

// The board mesh is 9" × 4" × 0.25" and the mod uses scale 2, so the board is 18" × 8" × 0.5". The mod turns
// it by 90°, so its long side runs along z, next to the mat edge (x = -18), halfway between the players.
export const BOARD_SCALE = 2
export const BOARD_X = -23.125
export const BOARD_HALF_LENGTH = 9
// Half of the board's short side, along x
export const BOARD_HALF_WIDTH = 4
// The mesh center is half its height above its bottom, so this puts the bottom on the table (y = 0)
export const BOARD_Y = 0.125 * BOARD_SCALE
// TTS turn 90° around Y. Z → -z changes the sign of a turn around Y (terrain/placementMove.js, toThreeTransform).
export const BOARD_YAW = -Math.PI / 2

// Spots on the board, in the board's own TTS coordinates (before scale): the snap points that the board
// script sets (longSnap). The first two rows are the VP track, the third row is the round track.
const X_SCORE = [-3.7, -2.7, -1.6, -0.5, 0.5, 1.6, 2.7, 3.7]
const Z_ROW = [-0.6, 0.5, 1.5]
const X_ROUND = [2.6, 1.62, 0.53, -0.53, -1.62, -2.6]

// Table { x, z } of a board spot. The TTS turn of 90° moves board (x, z) to TTS (z, -x), and z → -z makes
// the app z equal to the board x.
function boardPoint(boardX, boardZ) {
  return { x: BOARD_X + BOARD_SCALE * boardZ, z: BOARD_SCALE * boardX }
}

// VP_POINTS[n - 1] is the spot for n VP. The VP tracker script (checkScore) gives 1 VP at TTS z = -7.4, so
// VP 1 is at board x = 3.7, and each row runs against the order of X_SCORE.
export const VP_POINTS = Z_ROW.slice(0, 2).flatMap((row) =>
  [...X_SCORE].reverse().map((x) => boardPoint(x, row)),
)
// ROUND_POINTS[n - 1] is the spot for round n. The Round Tracker starts on round 1 at TTS z = -5.2.
export const ROUND_POINTS = X_ROUND.map((x) => boardPoint(x, Z_ROW[2]))

// A marker that is released this close to a spot moves onto it, as on a TTS snap point. Spots are about
// 2" apart, so a marker released on the track always lands on the nearest spot.
const SNAP_RADIUS = 1

// A VP marker is a round TTS tile (Custom_Tile type 2) with scale 0.6. A tile with scale 1 is 2" wide
// (scripts/README.md, "TTS crisis cards"), so the marker is 1.2" wide. Its edge has the player tint, its
// faces show the player's affiliation token (the Tray Spawner sets it, updateScoreTracker).
export const VP_MARKER_SIZE = 1.2
// The round marker mesh is a 2" cube with cut corners, and the mod uses scale 0.375: a 0.75" cube
export const ROUND_MARKER_SCALE = 0.375
export const ROUND_MARKER_HALF_SIZE = 1 * ROUND_MARKER_SCALE
export const ROUND_MARKER_TINT = [0.96, 0.79, 0.048]

// The Priority marker is a flat token 1.25" wide: the mod's Priority Token is a coin mesh scaled 1.25 (see
// docs/features/round-phases.md, "Priority marker"). It lies by the end of the board that is nearer its side, on
// the table between the board and the mat edge (x = -18): the crisis card and its supply pile end at x -19.4,
// and the board strip starts at z 12.6. The mod puts the token at (-17, 19) instead, outside the mat corner.
export const PRIORITY_MARKER_SIZE = 1.25
const PRIORITY_MARKER_X = -18.7
const PRIORITY_MARKER_Z = 10.8

// Spot of the Priority marker for `side` ('host' | 'guest'), { x, z }. The guest spot mirrors the host spot.
export function priorityMarkerSpot(side) {
  return { x: PRIORITY_MARKER_X, z: side === 'host' ? PRIORITY_MARKER_Z : -PRIORITY_MARKER_Z }
}

// Tint of each player color, the mod's tint (the tint of the VP marker edge). Keyed by color, not by side.
export const COLOR_TINT = { blue: [0.118, 0.53, 1], red: [0.856, 0.1, 0.094] }

// The VP markers start on the board, in the empty top-left corner: above the "1" box and left of the logo (the
// board.webp texture is 113.8 px per board unit, the board edge is at board z -2, the "1" box starts at board z
// -0.97 and the logo at board x 3.7 - (340 - 94) / 113.8 = 1.5). The corner strip is 2" high, so a 1.2" marker
// sits in its middle (board z -1.5). Side by side along z: host at the +z end (the host sits at +z), guest
// next to it. A margin of 0.5" from the end of the board and 0.2" between the markers keep them clear of the
// logo, the "1" box and the VP spots (no spot is within SNAP_RADIUS, so the start reads 0 VP).
const MARKER_START_MARGIN = 0.5
const MARKER_START_GAP = 0.2
const MARKER_START_X = boardPoint(0, -1.5).x
const HOST_MARKER_START_Z = BOARD_HALF_LENGTH - MARKER_START_MARGIN - VP_MARKER_SIZE / 2
const GUEST_MARKER_START_Z = HOST_MARKER_START_Z - VP_MARKER_SIZE - MARKER_START_GAP

// Start place of each VP marker, by side
export const VP_MARKERS = {
  host: { start: { x: MARKER_START_X, z: HOST_MARKER_START_Z } },
  guest: { start: { x: MARKER_START_X, z: GUEST_MARKER_START_Z } },
}

// Where every marker is when the app starts: { host, guest, round } → { x, z }
export const START_MARKERS = {
  host: VP_MARKERS.host.start,
  guest: VP_MARKERS.guest.start,
  round: ROUND_POINTS[0],
}

// The spot nearest to (x, z) within SNAP_RADIUS, or null. points: VP_POINTS or ROUND_POINTS.
export function snapPoint(points, x, z) {
  let nearest = null
  let nearestDistance = SNAP_RADIUS
  for (const p of points) {
    const distance = Math.hypot(p.x - x, p.z - z)
    if (distance <= nearestDistance) {
      nearest = p
      nearestDistance = distance
    }
  }
  return nearest
}

// The round spot after the one under the marker: the next one, the same one on round 6, or null when the
// marker is on no spot (a player moved it off the track, so the Cleanup Phase leaves it).
// position: { x, z }. See docs/features/round-phases.md, decision 13.
export function nextRoundSpot(position) {
  const spot = snapPoint(ROUND_POINTS, position.x, position.z)
  if (!spot) return null
  const i = ROUND_POINTS.indexOf(spot)
  return ROUND_POINTS[Math.min(i + 1, ROUND_POINTS.length - 1)]
}

// The score the markers show: { host, guest, round }. host and guest: VP, 0 when that marker is on no VP
// spot (it still waits at its start place). round: the round number (1 to 6), or null when the round
// marker is on no spot. markers: the scoreMarkers game field, { host, guest, round } → { x, z }, or null.
export function scoreFromMarkers(markers) {
  const at = (points, marker) => {
    const spot = marker ? snapPoint(points, marker.x, marker.z) : null
    return spot ? points.indexOf(spot) + 1 : 0
  }
  return {
    host: at(VP_POINTS, markers?.host),
    guest: at(VP_POINTS, markers?.guest),
    round: at(ROUND_POINTS, markers?.round) || null,
  }
}
