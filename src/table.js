// Table size and the walls at its edge. Plain module, no React, so scripts/dice-sim.mjs builds the
// same table in Node.

// The table is 72" wide (x) and 48" deep (z), the same 3:2 shape as the TTS table. It is wider than deep so that
// the scoring board and the crisis cards fit next to the mat, at their TTS positions.
export const TABLE_WIDTH = 72
export const TABLE_DEPTH = 48
// The table collider is much thicker than the visible table, so fast bodies cannot pass through it. Its top is at y = 0.
export const TABLE_COLLIDER_HALF_H = 5

// Below this height a body has fallen off the table. The walls below should stop that, so the dice use it only as a
// fallback (DiceTray.jsx).
export const FALL_LIMIT_Y = -10

// Invisible walls just outside the table edge. In TTS a die can leave the tray but not the table, so the walls
// keep a die that leaves its tray on the table.
// The wall body is kinematic, not fixed. The pointer and ground casts hit only fixed bodies (physics.js,
// CharacterModel.jsx), so they pass through the walls. A kinematic body that does not move blocks dynamic bodies
// in the same way as a fixed body. So the walls also stop a model that falls or tips at the table edge. A model
// that is dragged is kinematic, and two kinematic bodies do not collide, so a drag passes through the walls.
const WALL_THICKNESS = 2
const WALL_TOP = 20 // far above the highest throw, about 7" above the well floor
const WALL_BOTTOM = -2 * TABLE_COLLIDER_HALF_H // the bottom of the table collider, so there is no gap at the edge

const wallHalfH = (WALL_TOP - WALL_BOTTOM) / 2
const wallY = (WALL_TOP + WALL_BOTTOM) / 2
const halfT = WALL_THICKNESS / 2

// Cuboid colliders: half extents and center, [x, y, z]. The two walls at the x edges are longer by one wall
// thickness at each end, so they close the corners.
export const TABLE_WALLS = [
  { halfExtents: [halfT, wallHalfH, TABLE_DEPTH / 2 + WALL_THICKNESS], position: [TABLE_WIDTH / 2 + halfT, wallY, 0] },
  { halfExtents: [halfT, wallHalfH, TABLE_DEPTH / 2 + WALL_THICKNESS], position: [-TABLE_WIDTH / 2 - halfT, wallY, 0] },
  { halfExtents: [TABLE_WIDTH / 2, wallHalfH, halfT], position: [0, wallY, TABLE_DEPTH / 2 + halfT] },
  { halfExtents: [TABLE_WIDTH / 2, wallHalfH, halfT], position: [0, wallY, -TABLE_DEPTH / 2 - halfT] },
]
