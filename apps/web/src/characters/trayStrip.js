import { BOTH_LABEL } from './trayControls.js'
import { GRUNT_CARD_WIDTH } from './trays.js'

// Layout of the controls strip of a 3D tray (TrayStrip3D.jsx), in inches. Plain module, no React.
// Local x is to the right, y is up on the card (toward the mat), the origin is the strip center. The
// sizes follow the DOM controls (index.css, .tray-controls) at 40 CSS px per inch.

const COUNTER_W = 2.8
const COUNTER_H = 0.8
const CHIP_H = 0.34
const GAP_X = 0.15
const GAP_Y = 0.08

// A chip is as wide as its text (9 CSS px font, about 0.125in a letter) and a padding
function chipWidth(text) {
  return Math.max(0.8, 0.4 + 0.125 * text.length)
}

// Rows from the top: the counters (Damage left, Power right; a grunt has Damage only), one chip per attached
// card (gems: their labels), and Flip left, the Damage + Power button in the middle (not a grunt) and Remove right (a grunt has Remove only, centered). The block
// is centered in the strip. Returns { elements: [{ id, kind: 'counter' | 'chip', x, y, w, h }], width, height }.
export function stripLayout({ grunt = false, gems = [] }) {
  const counters = grunt ? ['damage'] : ['damage', 'power']
  // A grunt's one counter is as wide as its card, which is narrower than a character counter
  const counterW = grunt ? GRUNT_CARD_WIDTH : COUNTER_W
  const rowWidth = counters.length * counterW + (counters.length - 1) * GAP_X
  const rows = [{ h: COUNTER_H }]
  if (gems.length) rows.push({ h: CHIP_H })
  rows.push({ h: CHIP_H })
  const height = rows.reduce((sum, r) => sum + r.h, 0) + (rows.length - 1) * GAP_Y
  const elements = []
  let top = height / 2

  counters.forEach((id, i) => {
    elements.push({
      id,
      kind: 'counter',
      x: -rowWidth / 2 + counterW / 2 + i * (counterW + GAP_X),
      y: top - COUNTER_H / 2,
      w: counterW,
      h: COUNTER_H,
    })
  })
  top -= COUNTER_H + GAP_Y

  if (gems.length) {
    const widths = gems.map(chipWidth)
    let x = -(widths.reduce((a, b) => a + b, 0) + (gems.length - 1) * GAP_X) / 2
    gems.forEach((_, i) => {
      elements.push({
        id: `gem:${i}`,
        kind: 'chip',
        x: x + widths[i] / 2,
        y: top - CHIP_H / 2,
        w: widths[i],
        h: CHIP_H,
      })
      x += widths[i] + GAP_X
    })
    top -= CHIP_H + GAP_Y
  }

  const y = top - CHIP_H / 2
  const flipW = chipWidth('Flip')
  const removeW = chipWidth('Remove')
  if (!grunt)
    elements.push({
      id: 'flip',
      kind: 'chip',
      x: -rowWidth / 2 + flipW / 2,
      y,
      w: flipW,
      h: CHIP_H,
    })
  if (!grunt)
    elements.push({
      id: 'both',
      kind: 'chip',
      x: 0,
      y,
      w: chipWidth(BOTH_LABEL),
      h: CHIP_H,
    })
  elements.push({
    id: 'remove',
    kind: 'chip',
    x: grunt ? 0 : rowWidth / 2 - removeW / 2,
    y,
    w: removeW,
    h: CHIP_H,
  })
  return { elements, width: rowWidth, height }
}
