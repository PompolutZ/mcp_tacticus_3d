// The footprint of a tool as flat arms, for the outline that follows the pointer during a drag from the rack
// (tabletools/ToolDragGhost.jsx), and the rule for where a drop works. Plain module, no React. See
// docs/features/table-tools.md, "Tool rack".

import { MOVE_TIP, RANGE_TIP } from './toolTips.js'
import { onRack } from './layout.js'

const RANGE_WIDTH = 1
const MOVE_WIDTH = 0.56
// The Toward / Away tool spawns bent to a right angle: each arm 45 deg off the straight tool
const ANGLE_BEND = Math.PI / 4
// The Line of Sight ghost: as wide as a medium base (about 1 inch radius)
const LOS_GHOST_LENGTH = 3
const LOS_GHOST_WIDTH = 2

// The arms of the footprint of a tool, in the local frame of the tool: [{ angle, length, width }]. Each arm
// starts at the tool center and points along (cos angle, 0, -sin angle), the same as the tool halves.
// kind: 'range' | 'move' | 'angle' | 'los'. which: the range number (1 uses the R2 tool) or the movement type.
export function toolArms(kind, which) {
  if (kind === 'range') {
    const tip = RANGE_TIP[which === 1 ? 2 : which]
    return [
      { angle: 0, length: tip, width: RANGE_WIDTH },
      { angle: Math.PI, length: tip, width: RANGE_WIDTH },
    ]
  }
  if (kind === 'move') {
    const tip = MOVE_TIP[which]
    return [
      { angle: 0, length: tip, width: MOVE_WIDTH },
      { angle: Math.PI, length: tip, width: MOVE_WIDTH },
    ]
  }
  // The Line of Sight tool lies on a character, so the ghost is a short, base-wide line
  if (kind === 'los') return [{ angle: 0, length: LOS_GHOST_LENGTH, width: LOS_GHOST_WIDTH }]
  const tip = MOVE_TIP.long
  return [
    { angle: ANGLE_BEND, length: tip, width: MOVE_WIDTH },
    { angle: Math.PI - ANGLE_BEND, length: tip, width: MOVE_WIDTH },
  ]
}

// True when a drop at the table point { x, z } (or null, off the table) does something for `side`:
// not off the table and not over the own rack, where a tool goes back instead.
export function canDropTool(side, point) {
  return Boolean(point) && !onRack(side, point)
}
