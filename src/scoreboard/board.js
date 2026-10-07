// Scoring board geometry: where the board and its markers sit on the table, and the spots of the VP track
// and the round track. Plain module, no React, the same as table.js. See docs/feature-crisis.md,
// "Scoring board".
//
// The values come from the mod (3036795456) objects "Tracker" (the board), "Round Tracker", "Red Player VP
// Tracker" and "Blue Player VP tracker", read on 2026-10-03. TTS positions convert to the app with z → -z
// (Terrain.jsx). So TTS +z, the TTS Blue seat, is the app red side: a TTS object of the Red seat belongs to
// the app's blue player (see docs/feature-crisis.md, "Setup flow").

// The board mesh is 9" × 4" × 0.25" and the mod uses scale 2, so the board is 18" × 8" × 0.5". The mod turns
// it by 90°, so its long side runs along z, next to the mat edge (x = -18), halfway between the players.
export const BOARD_SCALE = 2
export const BOARD_X = -23.125
export const BOARD_HALF_LENGTH = 9
// Half of the board's short side, along x
export const BOARD_HALF_WIDTH = 4
// The mesh center is half its height above its bottom, so this puts the bottom on the table (y = 0)
export const BOARD_Y = 0.125 * BOARD_SCALE
// TTS turn 90° around Y. Z → -z changes the sign of a turn around Y (Terrain.jsx, toThreeTransform).
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
export const VP_POINTS = Z_ROW.slice(0, 2).flatMap(row => [...X_SCORE].reverse().map(x => boardPoint(x, row)))
// ROUND_POINTS[n - 1] is the spot for round n. The Round Tracker starts on round 1 at TTS z = -5.2.
export const ROUND_POINTS = X_ROUND.map(x => boardPoint(x, Z_ROW[2]))

// A marker that is released this close to a spot moves onto it, as on a TTS snap point. Spots are about
// 2" apart, so a marker released on the track always lands on the nearest spot.
export const SNAP_RADIUS = 1

// A VP marker is a round TTS tile (Custom_Tile type 2) with scale 0.6. A tile with scale 1 is 2" wide
// (scripts/README.md, "TTS crisis cards"), so the marker is 1.2" wide. Its edge has the player tint, its
// faces show the player's affiliation token (the Tray Spawner sets it, updateScoreTracker).
export const VP_MARKER_SIZE = 1.2
// The round marker mesh is a 2" cube with cut corners, and the mod uses scale 0.375: a 0.75" cube
export const ROUND_MARKER_SCALE = 0.375
export const ROUND_MARKER_HALF_SIZE = 1 * ROUND_MARKER_SCALE
export const ROUND_MARKER_TINT = [0.96, 0.79, 0.048]

// Tint and start place of each VP marker. The tint is the mod's tint of the same player color. The markers
// start next to the board, where the mod puts them. Because of z → -z, the app blue marker starts at the
// place of the mod's Red Player VP Tracker, and the app red marker at the place of its Blue one.
export const VP_MARKERS = {
  blue: { tint: [0.118, 0.53, 1], start: { x: -32.68, z: 10.82 } },
  red: { tint: [0.856, 0.1, 0.094], start: { x: -32.28, z: -10.81 } },
}

// Where every marker is when the app starts: { blue, red, round } → { x, z }
export const START_MARKERS = {
  blue: VP_MARKERS.blue.start,
  red: VP_MARKERS.red.start,
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
