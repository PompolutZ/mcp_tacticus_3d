// Tray geometry and coordinate conversion. Plain module, no React and no src/assets/index.js
// import, so scripts/dice-sim.mjs can use it in Node.
//
// "Tray space" is the tray mesh (src/assets/dice/tray.glb) turned 180 deg around Y
// (IMPORT_ROTATION, the same mirror fix as Terrain.jsx, because TTS mirrors X on OBJ import) and
// scaled by TRAY_SCALE. The tray bottom lands at tray-space y = 0.
//
// All the rectangles below come from the Phase 1 measurement (see docs/plan-dice-rolling.md,
// Phase 1 Result): a raycast grid over the tray mesh in tray space, 0.1" steps.

import { Quaternion, Vector3 } from 'three'
import { D8_CORNERS, D8_SIZE, FACES } from './faces.js'

export const TRAY_SCALE = 0.8
// Turn 180 deg around Y: (x, y, z) -> (-x, y, -z). Kept as the Euler triple, like Terrain.jsx,
// for anything that wants to set it as a rotation prop.
export const IMPORT_ROTATION = [0, Math.PI, 0]

// The well: where dice land and rest before a throw. Rectangle and floor height in tray space.
export const WELL = {
  xMin: -6.27,
  xMax: 6.33,
  zMin: -3.42,
  zMax: 4.98,
  floorY: 0.233,
}

// The shelf: where dice with a result stand, in rows. It is on the +z side of tray space
// (measured in Phase 1), which is why each tray below turns to face its shelf at world z = 0.
export const SHELF = {
  xMin: -6.37,
  xMax: 6.33,
  zMin: 5.28,
  zMax: 8.08,
  floorY: 1.033,
}

// How far above the well floor a new or rerolled die appears (design, "Roll flow").
export const DROP_HEIGHT = 4.8

// One tray per team color. Position is the tray's world origin (tray-space (0, 0, 0)); the tray
// bottom is on the table, so y = 0. yaw turns the tray so its shelf (tray-space +z) faces the
// center line (world z = 0): Blue sits on world +z, so it turns all the way around (yaw = PI);
// Red already faces the right way (yaw = 0). Color is the TTS tint (design, "Tray").
export const TRAYS = {
  blue: { position: { x: 27, y: 0, z: 10.1 }, yaw: Math.PI, color: [0.12, 0.53, 1] },
  red: { position: { x: 27, y: 0, z: -10.1 }, yaw: 0, color: [0.86, 0.1, 0.09] },
}

// The die's height standing flat on a face: the distance between that face and the opposite,
// parallel one. Computed from faces.js, not hardcoded, so it always matches D8_CORNERS.
function flatHeight() {
  const [i, j, k] = FACES[0].corners
  const [a, b, c] = [D8_CORNERS[i], D8_CORNERS[j], D8_CORNERS[k]]
  const centroid = a.map((v, n) => (v + b[n] + c[n]) / 3)
  return 2 * Math.hypot(...centroid)
}
export const DIE_FLAT_HEIGHT = flatHeight()

// The shelf holds 42 dice (design, "Roll flow") in rows. 14 columns fit the shelf width with
// room for the die's 0.665" edge; 3 rows fit its 2.8" depth the same way.
export const SHELF_SLOT_COUNT = 42
const SHELF_COLS = 14
const SHELF_ROWS = 3

// Tray-space position of shelf slot `index` (0..SHELF_SLOT_COUNT - 1), and the die center height
// there when it lies flat on the shelf floor.
export function shelfSlot(index) {
  const row = Math.floor(index / SHELF_COLS)
  const col = index % SHELF_COLS
  const colStep = (SHELF.xMax - SHELF.xMin) / SHELF_COLS
  const rowStep = (SHELF.zMax - SHELF.zMin) / SHELF_ROWS
  return {
    x: SHELF.xMin + colStep * (col + 0.5),
    y: SHELF.floorY + DIE_FLAT_HEIGHT / 2,
    z: SHELF.zMin + rowStep * (row + 0.5),
  }
}

const yAxis = new Vector3(0, 1, 0)
const scratchVec = new Vector3()
const scratchQuat = new Quaternion()

// Tray-space point -> world point, for tray `trayKey`.
export function trayToWorld(trayKey, point) {
  const tray = TRAYS[trayKey]
  scratchVec.set(point.x, point.y, point.z).applyAxisAngle(yAxis, tray.yaw)
  return { x: scratchVec.x + tray.position.x, y: scratchVec.y + tray.position.y, z: scratchVec.z + tray.position.z }
}

// World point -> tray-space point, for tray `trayKey`.
export function worldToTray(trayKey, point) {
  const tray = TRAYS[trayKey]
  scratchVec
    .set(point.x - tray.position.x, point.y - tray.position.y, point.z - tray.position.z)
    .applyAxisAngle(yAxis, -tray.yaw)
  return { x: scratchVec.x, y: scratchVec.y, z: scratchVec.z }
}

// Tray-space rotation ({ x, y, z, w }) -> world rotation, for tray `trayKey`.
export function trayToWorldRotation(trayKey, rotation) {
  scratchQuat.setFromAxisAngle(yAxis, TRAYS[trayKey].yaw)
  scratchQuat.multiply(new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w))
  return { x: scratchQuat.x, y: scratchQuat.y, z: scratchQuat.z, w: scratchQuat.w }
}

// World rotation -> tray-space rotation, for tray `trayKey`.
export function worldToTrayRotation(trayKey, rotation) {
  scratchQuat.setFromAxisAngle(yAxis, -TRAYS[trayKey].yaw)
  scratchQuat.multiply(new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w))
  return { x: scratchQuat.x, y: scratchQuat.y, z: scratchQuat.z, w: scratchQuat.w }
}

// The keys lip: the flat face on the player's side of the tray (tray-space -z, past the well's
// outer wall). It rises toward the well at about 14.4 deg. TTS puts its 5 tray buttons on it
// (Clear, -, count, +, Roll), so the app draws its tray keys there too (DiceKeys.jsx). Measured
// from tray.glb in tray space. The corners of the low edge are rounded, so the low edge is shorter
// (x +-6.14) than the high edge.
export const KEYS_LIP = {
  width: 13.17, // along x, at the high edge
  low: { y: 0.844, z: -6.92 }, // the outer edge
  high: { y: 1.554, z: -4.164 }, // the edge at the well wall
}

// The 6 raised plates on the rim past the shelf (tray-space +z). The tray texture prints a face
// icon on the half of each plate that is on the player's left (the Blank plate has no icon). TTS
// shows the count of each face on the other half. Measured from tray.glb in tray space: the
// plate centers and the plate size. From the player's left to right: Hit, Crit, Wild, Block,
// Blank, Skull, the same order as the TTS counters.
export const FACE_PLATES = {
  y: 1.668, // top of the plates
  z: 8.905,
  width: 1.64, // along x
  depth: 1.11, // along z
  x: { hit: 4.89, crit: 2.935, wild: 0.98, block: -0.98, blank: -2.935, skull: -4.89 },
}

// True when a world point falls inside the well's x/z rectangle, for tray `trayKey`. A die that
// rests outside the well (on the shelf, the rim, the table...) still counts (design, "Tilted
// dice"), so the app does not use this. scripts/dice-sim.mjs uses it to measure how often a die
// leaves the well.
export function inWell(trayKey, worldPoint) {
  const p = worldToTray(trayKey, worldPoint)
  return p.x >= WELL.xMin && p.x <= WELL.xMax && p.z >= WELL.zMin && p.z <= WELL.zMax
}

// Roll does not throw a die of the current throw again while it is higher than this above the
// height of a die that rests on the well floor. It only gives the die a new spin. TTS does the
// same: when Roll is pressed many times, each die is thrown again only when it falls back to about
// one height, as if it bounced on an invisible floor above the tray, and each press changes the
// spin of the dice above it. So the dice do not go higher with each press. A die that was not
// thrown yet (a new die that falls into the well) is thrown at any height. 5.6: the TTS height,
// measured on 2026-10-01 (scripts/tts-dice-measure.lua, "rapid rolls": 5.57-5.70).
export const ROLL_HEIGHT_LIMIT = 5.6

// True when a die center at this world point is higher than ROLL_HEIGHT_LIMIT above a die that
// rests on the well floor of tray `trayKey`.
export function aboveRollLimit(trayKey, worldPoint) {
  return worldToTray(trayKey, worldPoint).y > WELL.floorY + DIE_FLAT_HEIGHT / 2 + ROLL_HEIGHT_LIMIT
}

// A random point at the well floor, for throwVelocities' target. Not freeDropPoint (which places
// new dice above the well and keeps them apart): a thrown die aims at the floor and dice already
// in the air or in a pile change its path anyway (design, "Throw"). The point stays half a die
// from the walls. A die aimed at the foot of a wall hits it with its sideways speed and bounces
// out of the well more often.
export function randomWellPoint(trayKey, random = Math.random) {
  const margin = D8_SIZE / 2
  const x = WELL.xMin + margin + random() * (WELL.xMax - WELL.xMin - 2 * margin)
  const z = WELL.zMin + margin + random() * (WELL.zMax - WELL.zMin - 2 * margin)
  return trayToWorld(trayKey, { x, y: WELL.floorY, z })
}

// A random point above the well, at least one die size (D8_SIZE) from every point in `occupied`
// (world points), so new or rerolled dice do not spawn inside each other (design, "Pitfalls").
// Tries a new random point up to `triesPerHeight` times at the current height; if none is free,
// goes one die size higher and tries again. `occupied` and the result are world points.
export function freeDropPoint(trayKey, occupied, random = Math.random, triesPerHeight = 20) {
  const margin = D8_SIZE / 2
  let height = DROP_HEIGHT
  let candidate = null
  for (let attempt = 0; attempt < 1000; attempt++) {
    const x = WELL.xMin + margin + random() * (WELL.xMax - WELL.xMin - 2 * margin)
    const z = WELL.zMin + margin + random() * (WELL.zMax - WELL.zMin - 2 * margin)
    candidate = trayToWorld(trayKey, { x, y: WELL.floorY + height, z })
    const free = occupied.every(p => Math.hypot(p.x - candidate.x, p.y - candidate.y, p.z - candidate.z) >= D8_SIZE)
    if (free) return candidate
    if ((attempt + 1) % triesPerHeight === 0) height += D8_SIZE
  }
  return candidate
}

// The tray collider, in tray space, from the raw mesh arrays of tray.glb (a flat position array
// and a triangle index array, in mesh space). Applies IMPORT_ROTATION and TRAY_SCALE, so the app
// (DiceTray.jsx) and scripts/dice-sim.mjs build the exact same trimesh.
export function trayColliderArrays(positions, indices) {
  const vertices = new Float32Array(positions.length)
  for (let i = 0; i < positions.length; i += 3) {
    vertices[i] = -positions[i] * TRAY_SCALE // IMPORT_ROTATION: x -> -x
    vertices[i + 1] = positions[i + 1] * TRAY_SCALE
    vertices[i + 2] = -positions[i + 2] * TRAY_SCALE // IMPORT_ROTATION: z -> -z
  }
  return { vertices, indices: Uint32Array.from(indices) }
}
