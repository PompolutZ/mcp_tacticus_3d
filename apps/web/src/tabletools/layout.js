// Where the table tools lie: the tool rack of each player, and the board strip next to the scoring board.
// The Automatic Power Phase button of each player lies in the row of their Team Tactic tray, not on the rack. Plain module, no React, the same as characters/trays.js. See
// docs/features/table-tools.md, "Place on the table".
//
// Everything is computed for blue (+z) and mirrored for red: x and z change sign, and a piece turns
// 180 deg to face its owner (rackYaw), the same as the trays. The board strip does not turn: it reads like
// the scoring board for both players.

import { MOVE_TIP, RANGE_TIP } from './toolTips.js'
import { TACTIC_PLATE_WIDTH, tacticTrayPosition } from '../tactics/layout.js'

const sign = (side) => (side === 'blue' ? 1 : -1)

// The rack plate: the band past the deepest tray parts (z 33.75), as wide as 5 range tools lying in a row.
export const RACK_HALF_WIDTH = 15.2
export const RACK_Z_MIN = 34.2
export const RACK_Z_MAX = 36.8

// The rack pieces face their owner: for blue, the top points to -z (trays.js, trayYaw). Red is turned 180 deg.
export const rackYaw = (side) => (side === 'blue' ? 0 : Math.PI)

// Two rows lie along x. Row 1 is on the mat side.
const ROW_1_Z = 34.9
const ROW_2_Z = 36.1
const RANGE_WIDTH = 1
const MOVE_WIDTH = 0.56
const CHIP_WIDTH = 2
const CHIP_HEIGHT = 1
const RACK_MARGIN = 0.3
const ROW_2_GAP = 0.4

// Slots in local x, from the owner's left. Row 1 fills the plate width: the gaps are what is left.
const rangeLength = (mesh) => RANGE_TIP[mesh] * 2
const moveLength = (type) => MOVE_TIP[type] * 2

const ROW_1 = [
  { key: 'r1', kind: 'chip', length: CHIP_WIDTH, width: CHIP_HEIGHT },
  ...[2, 3, 4, 5].map((n) => ({
    key: `r${n}`,
    kind: 'range',
    length: rangeLength(n),
    width: RANGE_WIDTH,
  })),
]
const ROW_2 = [
  ...['short', 'medium', 'long'].map((type) => ({
    key: type[0],
    kind: 'move',
    length: moveLength(type),
    width: MOVE_WIDTH,
  })),
  { key: 'ta', kind: 'chip', length: CHIP_WIDTH, width: CHIP_HEIGHT },
]

// Local x of the center of each slot of a row, from the left end of the row at `left`
function placeRow(slots, left, gap) {
  let x = left
  return slots.map((slot) => {
    const placed = { ...slot, x: x + slot.length / 2 }
    x += slot.length + gap
    return placed
  })
}

const ROW_1_LENGTH = ROW_1.reduce((sum, slot) => sum + slot.length, 0)
const ROW_1_GAP = (RACK_HALF_WIDTH * 2 - RACK_MARGIN * 2 - ROW_1_LENGTH) / (ROW_1.length - 1)
const LOCAL_SLOTS = [
  ...placeRow(ROW_1, -RACK_HALF_WIDTH + RACK_MARGIN, ROW_1_GAP).map((s) => ({ ...s, z: ROW_1_Z })),
  ...placeRow(ROW_2, -RACK_HALF_WIDTH + RACK_MARGIN, ROW_2_GAP).map((s) => ({ ...s, z: ROW_2_Z })),
]

// The rack plate of `side`: { x, z, width, depth } (center and size)
export function rackPlate(side) {
  return {
    x: 0,
    z: ((RACK_Z_MIN + RACK_Z_MAX) / 2) * sign(side),
    width: RACK_HALF_WIDTH * 2,
    depth: RACK_Z_MAX - RACK_Z_MIN,
  }
}

// The slots of the rack of `side`: [{ key, kind, x, z, length, width }], center place and size on the table.
// key: r1 (chip), r2..r5, s, m, l, ta (chip). kind: 'chip', 'range' or 'move'. length lies along x. Row 1
// (mat side), from the owner's left: R1, R2..R5. Row 2: S, M, L, T/A. For red, the owner's left is +x.
export function rackSlots(side) {
  const s = sign(side)
  return LOCAL_SLOTS.map((slot) => ({ ...slot, x: slot.x * s, z: slot.z * s }))
}

// The Automatic Power Phase button of `side`: { x, z, width, depth }. It belongs to the squad, so it lies on
// the table in the row of the Team Tactic tray, to the owner's left of the tactic plate (blue: -x). Same z as
// the tray center. Free space there: x -20.6 (the board strip, the setup) to the plate edge -8.65, z 18.3 to
// 22.4 (the mat edge to the character tray row). width lies along x. See docs/features/table-tools.md,
// "Automatic Power Phase button".
export const POWER_GAP = 0.6 // from the left edge of the tactic plate
// Width in px (1 px = 0.04"): icon 22 + gap 6 + padding 2 x 6 + the label "Automatic Power Phase" (21 chars at
// 12px, estimated 7 px each) = 187 px
const POWER_WIDTH_PX = 22 + 6 + 12 + 21 * 7
export const POWER_WIDTH = POWER_WIDTH_PX * 0.04
export const POWER_DEPTH = 1.2
export function powerButton(side) {
  const s = sign(side)
  const x = -(TACTIC_PLATE_WIDTH / 2 + POWER_GAP + POWER_WIDTH / 2)
  return { x: x * s, z: tacticTrayPosition(side).z, width: POWER_WIDTH, depth: POWER_DEPTH }
}

// True when a table point { x, z } is on the rack plate of `side`
export function onRack(side, point) {
  const plate = rackPlate(side)
  return (
    Math.abs(point.x - plate.x) <= plate.width / 2 && Math.abs(point.z - plate.z) <= plate.depth / 2
  )
}

// The board strip: the corner between the mat and the end of the scoring board, one for each side. It holds
// two rows. Row 1 is nearer the table edge (-x), as the top row of something that reads like the scoring
// board. width lies along x, length along z.
const STRIP_X_MIN = -20.6
const STRIP_X_MAX = -18.3
const STRIP_Z_MIN = 12.6
const STRIP_Z_MAX = 18
const STRIP_ROW_X = [-20, -18.9]
export function boardStrip(side) {
  const s = sign(side)
  return {
    x: (STRIP_X_MIN + STRIP_X_MAX) / 2,
    z: ((STRIP_Z_MIN + STRIP_Z_MAX) / 2) * s,
    width: STRIP_X_MAX - STRIP_X_MIN,
    length: STRIP_Z_MAX - STRIP_Z_MIN,
    // x of the center of row 1 and row 2
    rowX: STRIP_ROW_X,
  }
}

// The edge controls of the setup (↺ Choose this edge ↻) lie on the side of the player with Priority, flat and
// facing that player (OWNER_FACING_ROTATION), in the row of the Team Tactic tray on the owner's right of the
// tactic plate: the mirror of the Automatic Power Phase button (docs/features/setup-game.md, "Buttons"). They
// are inside the start view and next to the mat that the arrows turn. Free there: the band between the mat
// edge (z 18) and the tactic plate's outer z (22.4), 4.1" deep, and x from the plate edge on to the dice
// tray (20.25). width lies along x, depth along z. Two rows: the arrows, then the Choose button below them
// (toward the table edge). Sizes in inches, 1 CSS px is 0.04".
export const EDGE_GAP = 0.6 // from the right edge of the tactic plate
export const EDGE_ARROW_WIDTH = 2.2
export const EDGE_ARROW_HEIGHT = 1.4
export const EDGE_CHOOSE_HEIGHT = 1.2
export const EDGE_ROW_GAP = 0.2
export const EDGE_ARROW_GAP = 0.8
export const EDGE_WIDTH = 7.2
export function edgeControls(side) {
  const s = sign(side)
  const depth = EDGE_ARROW_HEIGHT + EDGE_ROW_GAP + EDGE_CHOOSE_HEIGHT
  const x = TACTIC_PLATE_WIDTH / 2 + EDGE_GAP + EDGE_WIDTH / 2
  return { x: x * s, z: tacticTrayPosition(side).z, width: EDGE_WIDTH, depth }
}
