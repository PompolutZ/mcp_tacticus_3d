// Where the table tools lie: the tool rack of each player, and the board strip next to the scoring board.
// The Automatic Power Phase button of each player lies in row 1 of their board strip, not on the rack. Plain module, no React, the same as characters/trays.js. See
// docs/features/table-tools.md, "Place on the table".
//
// Everything is computed for host (+z) and mirrored for guest: x and z change sign (the rack: z only, because
// the dice trays are not mirrored in x), and a piece turns 180 deg to face its owner (rackYaw), the same as
// the trays. The board strip does not turn: it reads like
// the scoring board for both players.

import { RANGE_HALF_WIDTH, moveLength, rangeLength } from './toolTips.js'
import { TACTIC_PLATE_WIDTH, tacticTrayPosition } from '../tactics/layout.js'
import { ROSTER_ROWS_OUTER_Z } from '../rosters/layout.js'
import { KEYS_LIP, TRAYS } from '../dice/tray.js'
import { sideSign, sideYaw } from '../setup/setup.js'

const sign = sideSign

// The rack lies in front of the dice tray of its player: centered in x on the tray, as wide as the keys lip,
// starting past the keys lip (the outer edge of the tray on the player's side). The tray is at the same x for
// both players, so the guest rack is the host rack mirrored in z only, turned 180 deg.
const TRAY_HOST = TRAYS.host
const RACK_X = TRAY_HOST.position.x
// Narrower than the tray (x 20.4 to 33.6) by 0.2": a row of 7 character trays ends at x 20.5 and must not touch it
const RACK_HALF_WIDTH = 6.4
const KEYS_LIP_GAP = 2
// World z of the keys lip low edge of the host tray (tray-space z turns with the tray yaw)
const KEYS_LIP_Z = TRAY_HOST.position.z + KEYS_LIP.low.z * Math.cos(TRAY_HOST.yaw)
const RACK_Z_MIN = KEYS_LIP_Z + KEYS_LIP_GAP

// The rack pieces face their owner: for host, the top points to -z (trays.js, trayYaw). Guest is turned 180 deg.
export const rackYaw = sideYaw

const RANGE_WIDTH = 2 * RANGE_HALF_WIDTH
const MOVE_WIDTH = 0.56
const CHIP_WIDTH = 2
const CHIP_HEIGHT = 1
const RACK_MARGIN = 0.3
const COLUMN_GAP = 0.4

// The items of a column. A tool lies along z (its length), a chip is CHIP_WIDTH along x and CHIP_HEIGHT along z
// (the text faces the owner). sizeX, sizeZ: the footprint on the table.
const chip = (key) => ({
  key,
  kind: 'chip',
  length: CHIP_WIDTH,
  width: CHIP_HEIGHT,
  sizeX: CHIP_WIDTH,
  sizeZ: CHIP_HEIGHT,
})
const range = (n) => ({
  key: `r${n}`,
  kind: 'range',
  length: rangeLength(n),
  width: RANGE_WIDTH,
  sizeX: RANGE_WIDTH,
  sizeZ: rangeLength(n),
})
const move = (type) => ({
  key: type[0],
  kind: 'move',
  length: moveLength(type),
  width: MOVE_WIDTH,
  sizeX: MOVE_WIDTH,
  sizeZ: moveLength(type),
})

// The columns from the owner's left. Item 1 is on the mat side, item 2 below it (toward the table edge).
const COLUMNS = [
  [chip('r1'), move('long'), chip('los')],
  [range(2), move('medium')],
  [range(3), move('short')],
  [range(4), chip('ta')],
  [range(5)],
]
const columnWidth = (column) => Math.max(...column.map((item) => item.sizeX))
const columnDepth = (column) =>
  column.reduce((sum, item) => sum + item.sizeZ, 0) + COLUMN_GAP * (column.length - 1)

const COLUMNS_WIDTH = COLUMNS.reduce((sum, column) => sum + columnWidth(column), 0)
// The gap between columns is what is left of the plate width
const COLUMN_SPACE = (RACK_HALF_WIDTH * 2 - RACK_MARGIN * 2 - COLUMNS_WIDTH) / (COLUMNS.length - 1)
const RACK_DEPTH = Math.max(...COLUMNS.map(columnDepth)) + RACK_MARGIN * 2
const RACK_Z_MAX = RACK_Z_MIN + RACK_DEPTH

// Slots of the host rack: x is from the plate center, to the owner's left (-x), z in the table
let columnLeft = -RACK_HALF_WIDTH + RACK_MARGIN
const LOCAL_SLOTS = COLUMNS.flatMap((column) => {
  const width = columnWidth(column)
  const x = RACK_X + columnLeft + width / 2
  columnLeft += width + COLUMN_SPACE
  let z = RACK_Z_MIN + RACK_MARGIN
  return column.map((item) => {
    const placed = { ...item, x, z: z + item.sizeZ / 2 }
    z += item.sizeZ + COLUMN_GAP
    return placed
  })
})

// The rack plate of `side`: { x, z, width, depth } (center and size)
export function rackPlate(side) {
  return {
    x: RACK_X,
    z: ((RACK_Z_MIN + RACK_Z_MAX) / 2) * sign(side),
    width: RACK_HALF_WIDTH * 2,
    depth: RACK_DEPTH,
  }
}

// The slots of the rack of `side`: [{ key, kind, x, z, length, width, sizeX, sizeZ }], center place and size on
// the table. key: r1 (chip), r2..r5, s, m, l, ta (chip). kind: 'chip', 'range' or 'move'. length and width are
// the sizes of the item itself (a tool lies along z). sizeX, sizeZ: its footprint on the table. Columns, from
// the owner's left: (R1, L), (R2, M), (R3, S), (R4, T/A), (R5). Mat side first. For guest, the owner's left is
// +x, and z changes sign, but x stays on the dice tray.
export function rackSlots(side) {
  const s = sign(side)
  return LOCAL_SLOTS.map((slot) => ({
    ...slot,
    x: RACK_X + (slot.x - RACK_X) * s,
    z: slot.z * s,
  }))
}

// True when a table point { x, z } is on the rack plate of `side`
export function onRack(side, point) {
  const plate = rackPlate(side)
  return (
    Math.abs(point.x - plate.x) <= plate.width / 2 && Math.abs(point.z - plate.z) <= plate.depth / 2
  )
}

// The board strip: the corner between the mat and the end of the scoring board, one for each side. It holds
// two rows. Row 1: Automatic Power Phase. Row 2: Deploy Lock and the mat turn buttons. Row 1 is nearer the table edge (-x), as the top row of something that reads like the scoring
// board. width lies along x, length along z.
const STRIP_X_MIN = -20.6
const STRIP_X_MAX = -18.3
const STRIP_Z_MIN = 12.6
const STRIP_Z_MAX = 18
const STRIP_ROW_X = [-20, -18.9]
const STRIP_ROW_WIDTH = 1
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

// The Automatic Power Phase button of `side`: { x, z, width, length }. It belongs to the squad, so it lies in
// row 1 of the board strip of its side, along z like the strip, the top facing -x (it reads like the scoring
// board). width lies along x (one row), length along z (the strip length, 5.4"). See
// docs/features/table-tools.md, "Automatic Power Phase button".
export function powerButton(side) {
  const strip = boardStrip(side)
  return { x: strip.rowX[0], z: strip.z, width: STRIP_ROW_WIDTH, length: strip.length }
}

// The Cleanup Phase button: one for the table, at z 0 in the gap between the scoring board (x edge -19.1) and
// the mat edge (x -18), turned like the strip. The gap is 1.1" deep, the button 1" (STRIP_ROW_WIDTH), 0.05"
// free on each side. width lies along x, length along z. See docs/features/round-phases.md.
const BOARD_EDGE_X = -19.1
const MAT_EDGE_X = -18
export function cleanupButton() {
  return {
    x: (BOARD_EDGE_X + MAT_EDGE_X) / 2,
    z: 0,
    width: STRIP_ROW_WIDTH,
    length: STRIP_Z_MAX - STRIP_Z_MIN,
  }
}

// The edge controls of the setup (↺ Choose this edge ↻) lie on the side of the player with Priority, flat and
// facing that player (OWNER_FACING_ROTATION), in the row of the Team Tactic tray on the owner's right of the
// tactic plate: the mirror of the Automatic Power Phase button (docs/features/setup-game.md, "Buttons"). They
// are inside the start view and next to the mat that the arrows turn. Free there: the band between the mat
// edge (z 18) and the tactic plate's outer z (22.4), 4.1" deep, and x from the plate edge on to the dice
// tray (20.25). width lies along x, depth along z. Two rows: the arrows, then the Choose button below them
// (toward the table edge). Sizes in inches, 1 CSS px is 0.04".
const EDGE_GAP = 0.6 // from the right edge of the tactic plate
export const EDGE_ARROW_WIDTH = 2.2
export const EDGE_ARROW_HEIGHT = 1.4
export const EDGE_CHOOSE_HEIGHT = 1.2
export const EDGE_ROW_GAP = 0.2
export const EDGE_ARROW_GAP = 0.8
const EDGE_WIDTH = 7.2
export function edgeControls(side) {
  const s = sign(side)
  const depth = EDGE_ARROW_HEIGHT + EDGE_ROW_GAP + EDGE_CHOOSE_HEIGHT
  const x = TACTIC_PLATE_WIDTH / 2 + EDGE_GAP + EDGE_WIDTH / 2
  return { x: x * s, z: tacticTrayPosition(side).z, width: EDGE_WIDTH, depth }
}

// The squad panel of the setup (Threat, Tactics, Squad ready, hint, problem) lies flat and facing its owner,
// right below the roster rows (past the Team Tactic cards, row 2), centered in x. The free band is between the
// far edge of row 2 (z 29.5) and SQUAD_PANEL_Z_MAX (33.95), 4.45" deep; the panel keeps 0.25" free on
// the roster side. width lies along x. See docs/features/setup-game.md, "Buttons".
// The character trays of a placed squad reach z 31.85, so a placed side (or the other player's panel, one
// line "Choosing a squad" / "Ready") uses `compact`: a 1.6" band past the trays, z 32.1 to 33.7.
// The far edge of the panel (z 33.95), 0.2" past the deepest tray parts (z 33.75). It was the rack plate edge
// (34.2) less the margin, before the rack moved to the dice tray.
const SQUAD_PANEL_Z_MAX = 33.95
const SQUAD_PANEL_MARGIN = 0.25
const SQUAD_PANEL_WIDTH = 24
const TRAYS_OUTER_Z = 31.85
const COMPACT_DEPTH = 1.6
export function squadPanel(side, compact = false) {
  const z0 = (compact ? TRAYS_OUTER_Z : ROSTER_ROWS_OUTER_Z) + SQUAD_PANEL_MARGIN
  const z1 = compact ? z0 + COMPACT_DEPTH : SQUAD_PANEL_Z_MAX
  return { x: 0, z: ((z0 + z1) / 2) * sign(side), width: SQUAD_PANEL_WIDTH, depth: z1 - z0 }
}
