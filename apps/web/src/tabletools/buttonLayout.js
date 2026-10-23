// Where the buttons at the snapped end of a range or movement tool lie, in the local frame of the tool, and how
// much room each takes. Plain module, no React, so a Node test can check that they do not overlap. The buttons
// are in ToolButtons.jsx and RulerTool.jsx. See docs/features/range-movement-tools.md, "Unsnap".

// drei's Html transform draws 1 CSS px as 1/40 world unit (see DiceKeys.jsx)
export const PX_PER_INCH = 40
// Share of the tool width that a button covers
export const PLACE_FILL = 0.85
// A button is this wide in CSS px, and this high with one or two lines of label
const BUTTON_PX = { width: 40, one: 21, two: 34 }

// Place and Throw sit this far in from the tip (the center of the button)
export const PLACE_INSET = 0.75
// Unsnap on a tool with a button across it sits nearer the tip than Throw, so the two share the snapped end
const UNSNAP_INSET = 0.25

// The room of a button on the tool, in inches: { along (x), across (z) }. toolWidth: width of the tool.
// lines: lines of the label. alongTool: the label reads along the tool (R1), else across it.
export function buttonSize({ toolWidth, lines = 1, alongTool = false }) {
  const scale = PLACE_FILL * toolWidth
  const w = (BUTTON_PX.width * scale) / PX_PER_INCH
  const h = (BUTTON_PX[lines === 2 ? 'two' : 'one'] * scale) / PX_PER_INCH
  return alongTool ? { along: w, across: h } : { along: h, across: w }
}

// Local center { x, z } of the buttons at the snapped end of a tool snapped with half `side`, for the tool
// kind: bendable (movement), rangeOne. across: the long side of R1 that the base touches (±1).
// { unsnap, throwPush (movement tool), placeOne (R1) }
export function snapEndButtons({ tip, halfWidth, side, across = 1, bendable, rangeOne }) {
  const sign = side === 'right' ? 1 : -1
  const at = (inset, z = 0) => ({ x: sign * (tip - inset), z })
  if (rangeOne) {
    // Place 1 on one half of the width, Unsnap on the other
    return {
      placeOne: at(PLACE_INSET, (-across * halfWidth) / 2),
      unsnap: at(PLACE_INSET, (across * halfWidth) / 2),
    }
  }
  if (bendable) return { throwPush: at(PLACE_INSET), unsnap: at(UNSNAP_INSET) }
  return { unsnap: at(UNSNAP_INSET) }
}
