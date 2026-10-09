// The Crisis Protocol die: a regular octahedron, 6 corners, 8 faces, 6 symbols on 8 faces.
// Plain module, no React and no src/assets/index.js import, so scripts/dice-sim.mjs can use it in Node.
//
// Face numbers, symbols and corners come from 3 TTS sources, cross-checked against each other:
// - `RotationValues` in the tray script (see docs/plan-dice-rolling.md): for each face number, the
//   Euler rotation that shows it face up. Converted to the local "up" direction with the same
//   Unity -> three.js quaternion conversion as Terrain.jsx (mirror Z, negate the X and Y angles).
// - The TTS D8 mesh (`D8_1885.obj`, from AssetRipper) and its UVs.
// - The TTS D8 template (`d8_template.png`), which has the face number drawn on each UV triangle.
// The 3 sources agree exactly on which face number is on which mesh face and which local direction
// is "up" for it, so the face table below is the same regardless of which source is trusted most.

// Shelf order, left to right
export const SYMBOLS = ['crit', 'wild', 'hit', 'block', 'blank', 'skull']

export const SYMBOL_NAMES = {
  crit: 'Crit',
  wild: 'Wild',
  hit: 'Hit',
  block: 'Block',
  blank: 'Blank',
  skull: 'Skull',
}

// Tip to tip, inches. The tray script scales the TTS die (built-in D8 shape) by the tray scale 0.8,
// which gives 0.94" tip to tip. The app die is a regular octahedron of the same size, not the TTS
// mesh: the TTS mesh has bevelled edges, is about 3% longer tip to tip than corner to corner, and
// its license is unknown.
export const D8_SIZE = 0.94

const TIP = D8_SIZE / 2
const EQ = TIP / Math.SQRT2

// 6 corners of the octahedron. Tips on +-z (the TTS die has its tips on local +-z too, see
// D8_1885.obj). The 4 equatorial corners are on the x/y diagonals, not on the x or y axis.
export const D8_CORNERS = [
  [0, 0, TIP], // 0: +z tip
  [0, 0, -TIP], // 1: -z tip
  [-EQ, EQ, 0], // 2
  [EQ, EQ, 0], // 3
  [EQ, -EQ, 0], // 4
  [-EQ, -EQ, 0], // 5
]

function faceNormal([i, j, k]) {
  const [a, b, c] = [D8_CORNERS[i], D8_CORNERS[j], D8_CORNERS[k]]
  const centroid = a.map((v, n) => (v + b[n] + c[n]) / 3)
  const length = Math.hypot(...centroid)
  return centroid.map((v) => v / length)
}

// index = face number - 1. corners: counter-clockwise seen from outside (checked with the cross
// product of each face, and against the die texture: skull on 1, shield on 2, starburst on 3 and 6,
// "!" burst on 5, spiral on 7, blank on 4 and 8).
const FACE_CORNERS = [
  [1, 3, 4], // 1 skull
  [1, 4, 5], // 2 block
  [0, 5, 4], // 3 hit
  [0, 4, 3], // 4 blank
  [0, 2, 5], // 5 crit
  [0, 3, 2], // 6 hit
  [1, 2, 3], // 7 wild
  [1, 5, 2], // 8 blank
]

const FACE_SYMBOLS = ['skull', 'block', 'hit', 'blank', 'crit', 'hit', 'wild', 'blank']

export const FACES = FACE_CORNERS.map((corners, i) => ({
  number: i + 1,
  symbol: FACE_SYMBOLS[i],
  corners,
  normal: faceNormal(corners),
}))

// Edge length, from 2 adjacent corners
const EDGE = Math.hypot(...D8_CORNERS[0].map((v, i) => v - D8_CORNERS[2][i]))
// Volume of a regular octahedron with edge length a: (sqrt(2) / 3) * a^3
const VOLUME = (Math.SQRT2 / 3) * EDGE ** 3
// Density that gives the die a mass of 1
export const D8_DENSITY = 1 / VOLUME
