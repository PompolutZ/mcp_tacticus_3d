// Where the roster cards lie on the table. Plain module, no React, the same as characters/trays.js.
// See docs/feature-roster.md, "On the table".

import { TABLE_WIDTH } from '../table.js'
import { TRAY_CARD_HEIGHT, TRAY_CARD_WIDTH } from '../characters/trays.js'
import { TACTIC_CARD_HEIGHT, TACTIC_CARD_WIDTH, TACTIC_TRAY_OUTER_Z } from '../tactics/layout.js'
import { CARD_HEIGHT as CRISIS_CARD_HEIGHT, CARD_WIDTH as CRISIS_CARD_WIDTH } from '../crisis/layout.js'

// Below the character trays (y = 0.02), so a tray draws on top of a roster card
export const ROSTER_CARD_Y = 0.01

const ROW_GAP = 0.3 // row 1 to the tactic tray, and row 2 to row 1
const CARD_GAP = 0.3
const GROUP_GAP = 1
// A row wider than the table minus this margin on both sides is scaled down to fit
const TABLE_MARGIN = 1

const SIZES = {
  character: [TRAY_CARD_WIDTH, TRAY_CARD_HEIGHT],
  tactic: [TACTIC_CARD_WIDTH, TACTIC_CARD_HEIGHT],
  secure: [CRISIS_CARD_WIDTH, CRISIS_CARD_HEIGHT],
  extract: [CRISIS_CARD_WIDTH, CRISIS_CARD_HEIGHT],
}

// Local x of the cards of one row, centered on x = 0, from the owner's left. groups: lists of cards
// { kind, ... }. Returns [{ ...card, x, width, height }] and the scale that was used.
function placeRow(groups) {
  const cards = groups.filter(group => group.length > 0)
  const count = cards.reduce((sum, group) => sum + group.length, 0)
  if (count === 0) return { placed: [], scale: 1, width: 0 }
  const cardsWidth = cards.flat().reduce((sum, card) => sum + SIZES[card.kind][0], 0)
  const gaps = (count - cards.length) * CARD_GAP + (cards.length - 1) * GROUP_GAP
  const natural = cardsWidth + gaps
  const scale = Math.min(1, (TABLE_WIDTH - TABLE_MARGIN * 2) / natural)
  let x = -(natural * scale) / 2
  const placed = []
  cards.forEach((group, g) => {
    if (g > 0) x += GROUP_GAP * scale
    group.forEach((card, i) => {
      if (i > 0) x += CARD_GAP * scale
      const [w, h] = SIZES[card.kind]
      placed.push({ ...card, x: x + (w * scale) / 2, width: w * scale, height: h * scale })
      x += w * scale
    })
  })
  return { placed, scale, width: natural * scale }
}

// The cards of `parsed` (mct.js) for `team`: [{ code, kind, gems, x, z, width, height, yaw }]. Row 1 holds the
// characters, row 2 the Team Tactic, Secure and Extract cards. Computed for blue (+z), then mirrored
// for red, the same as the trays: x and z change sign, and the card turns 180 deg to face its owner.
export function rosterLayout(team, parsed) {
  const side = team === 'blue' ? 1 : -1
  const yaw = team === 'blue' ? 0 : Math.PI
  const row1Z = TACTIC_TRAY_OUTER_Z + ROW_GAP
  const row2Z = row1Z + TRAY_CARD_HEIGHT + ROW_GAP
  const row2Depth = Math.max(TACTIC_CARD_HEIGHT, CRISIS_CARD_HEIGHT)
  const rows = [
    [row1Z + TRAY_CARD_HEIGHT / 2, [parsed.characters.map(c => ({ code: c.code, kind: 'character', gems: c.gems }))]],
    [row2Z + row2Depth / 2, ['tactic', 'secure', 'extract'].map(kind => parsed[kind === 'tactic' ? 'tactics' : kind].map(code => ({ code, kind, gems: [] })))],
  ]
  return rows.flatMap(([z, groups]) => placeRow(groups).placed.map(card => ({ ...card, x: card.x * side, z: z * side, yaw })))
}

// Sizes of both rows, for the Node check: [{ width, scale }]
export function rosterRowInfo(parsed) {
  return [
    placeRow([parsed.characters.map(() => ({ kind: 'character' }))]),
    placeRow(['tactics', 'secure', 'extract'].map(group => parsed[group].map(() => ({ kind: group === 'tactics' ? 'tactic' : group })))),
  ].map(({ width, scale }) => ({ width, scale }))
}
