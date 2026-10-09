// Where the roster cards lie on the table. Plain module, no React, the same as characters/trays.js.
// See docs/feature-roster.md, "On the table", and docs/feature-setup-game.md, "On the table".

import { TABLE_WIDTH } from '../table.js'
import { TRAY_CARD_HEIGHT, TRAY_CARD_WIDTH } from '../characters/trays.js'
import { TACTIC_CARD_HEIGHT, TACTIC_CARD_WIDTH, TACTIC_TRAY_OUTER_Z } from '../tactics/layout.js'
import {
  CARD_HEIGHT as CRISIS_CARD_HEIGHT,
  CARD_WIDTH as CRISIS_CARD_WIDTH,
  CARD_Z as BOARD_CARD_Z,
} from '../crisis/layout.js'
import { BOARD_X } from '../scoreboard/board.js'

// Below the character trays (y = 0.02), so a tray draws on top of a roster card
export const ROSTER_CARD_Y = 0.01

const ROW_GAP = 0.3 // row 1 to the tactic tray, and row 2 to row 1
const CARD_GAP = 0.3
const GROUP_GAP = 1
// A row wider than the table minus this margin on both sides is scaled down to fit
const TABLE_MARGIN = 1

// Card size on the table in inches, [width, height], by card kind. The roster popup uses it for the aspect ratio.
export const CARD_SIZES = {
  character: [TRAY_CARD_WIDTH, TRAY_CARD_HEIGHT],
  tactic: [TACTIC_CARD_WIDTH, TACTIC_CARD_HEIGHT],
  secure: [CRISIS_CARD_WIDTH, CRISIS_CARD_HEIGHT],
  extract: [CRISIS_CARD_WIDTH, CRISIS_CARD_HEIGHT],
}

// Local x of the cards of one row, centered on x = 0, from the owner's left. groups: lists of cards
// { kind, ... }. A row wider than maxWidth is scaled down to fit. Returns [{ ...card, x, width, height }]
// and the scale that was used.
function placeRow(groups, maxWidth = TABLE_WIDTH - TABLE_MARGIN * 2) {
  const cards = groups.filter((group) => group.length > 0)
  const count = cards.reduce((sum, group) => sum + group.length, 0)
  if (count === 0) return { placed: [], scale: 1, width: 0 }
  const cardsWidth = cards.flat().reduce((sum, card) => sum + CARD_SIZES[card.kind][0], 0)
  const gaps = (count - cards.length) * CARD_GAP + (cards.length - 1) * GROUP_GAP
  const natural = cardsWidth + gaps
  const scale = Math.min(1, maxWidth / natural)
  let x = -(natural * scale) / 2
  const placed = []
  cards.forEach((group, g) => {
    if (g > 0) x += GROUP_GAP * scale
    group.forEach((card, i) => {
      if (i > 0) x += CARD_GAP * scale
      const [w, h] = CARD_SIZES[card.kind]
      placed.push({ ...card, x: x + (w * scale) / 2, width: w * scale, height: h * scale })
      x += w * scale
    })
  })
  return { placed, scale, width: natural * scale }
}

const side = (team) => (team === 'blue' ? 1 : -1)
// A card faces its owner, the same as a tray card: for blue, the image top points to -z
const cardYaw = (team) => (team === 'blue' ? 0 : Math.PI)

// The cards of `parsed` (mct.js) for `team`: [{ code, kind, gems, x, z, width, height, yaw }]. Row 1 holds the
// characters, row 2 the Team Tactic cards. The crisis cards lie next to the scoring board (crisisRowLayout).
// Computed for blue (+z), then mirrored for red, the same as the trays: x and z change sign, and the card
// turns 180 deg to face its owner.
export function rosterLayout(team, parsed) {
  const row1Z = TACTIC_TRAY_OUTER_Z + ROW_GAP
  const row2Z = row1Z + TRAY_CARD_HEIGHT + ROW_GAP
  const rows = [
    [
      row1Z + TRAY_CARD_HEIGHT / 2,
      [parsed.characters.map((c) => ({ code: c.code, kind: 'character', gems: c.gems }))],
    ],
    [
      row2Z + TACTIC_CARD_HEIGHT / 2,
      [parsed.tactics.map((code) => ({ code, kind: 'tactic', gems: [] }))],
    ],
  ]
  return rows.flatMap(([z, groups]) =>
    placeRow(groups).placed.map((card) => ({
      ...card,
      x: card.x * side(team),
      z: z * side(team),
      yaw: cardYaw(team),
    })),
  )
}

// Sizes of both rows, for the Node check: [{ width, scale }]
export function rosterRowInfo(parsed) {
  return [
    placeRow([parsed.characters.map(() => ({ kind: 'character' }))]),
    placeRow([parsed.tactics.map(() => ({ kind: 'tactic' }))]),
  ].map(({ width, scale }) => ({ width, scale }))
}

// The crisis cards of a roster lie next to the scoring board, on the owner's side, until the game setup
// puts the two cards of the mission on the board ends. They are turned the same way as the board and the
// cards on its ends (CrisisCard.jsx): the image top faces the table edge (-x). So each row runs along z,
// parallel to the board. A row starts next to the board end, and its first card is the one nearest to the
// board. The Secure row is the first row, at the table edge. The Extract row lies toward the mat. Between
// the rows is a gap for the deck buttons (GameSetup.jsx).
// The cards drawn from a deck, and at last the card that the mission uses, lie in one row in line with the
// board instead (DRAWN_ROW_X). So the chosen card ends up next to the board end.
// Numbers are for blue (+z). Red is the same at -z: only z changes sign, so the cards read the same way.
const CRISIS_CARD_YAW = Math.PI / 2
// The rows start past the Secure card on the board end. The deck area is as long as a row of 5 cards, the
// most of one type in a roster (docs/feature-roster.md, "Terms"). A row of more cards is scaled down to fit.
const CRISIS_START_Z = BOARD_CARD_Z.secure + CRISIS_CARD_WIDTH / 2 + ROW_GAP
const CRISIS_ROW_LENGTH = 5 * CRISIS_CARD_WIDTH + 4 * CARD_GAP
// The deck rows reach past the tactic tray, next to roster row 1 (rosterLayout). So they lie between the
// table edge and the end of a row of 10 character cards (x = -23.85). The Extract row ends 0.3" before it.
const BUTTON_GAP = 1.2
const SECURE_ROW_X = -TABLE_WIDTH / 2 + TABLE_MARGIN + CRISIS_CARD_HEIGHT / 2
const CRISIS_ROW_X = {
  secure: SECURE_ROW_X,
  extract: SECURE_ROW_X + CRISIS_CARD_HEIGHT + BUTTON_GAP,
}
// The drawn cards lie on the long axis of the board, the same x as the cards on the board ends. They are at
// most 2 cards, so they end long before the roster rows (z = 22.7).
const DRAWN_ROW_X = BOARD_X

// x of the middle of the gap between the 2 deck rows, the same for both players
export const CRISIS_GAP_X = SECURE_ROW_X + CRISIS_CARD_HEIGHT / 2 + BUTTON_GAP / 2
// x of the Use buttons of the drawn cards: next to the cards, on the table-edge side
export const USE_BUTTON_X = DRAWN_ROW_X - CRISIS_CARD_HEIGHT / 2 - BUTTON_GAP / 2

// z of the middle of the deck area of `team`
export function crisisCenterZ(team) {
  return (CRISIS_START_Z + CRISIS_ROW_LENGTH / 2) * side(team)
}

// The crisis cards `codes` of `type` ('secure' | 'extract') of `team`, in one row:
// [{ code, kind, gems, x, z, width, height, yaw }]. drawn: the cards were drawn from the deck (setup/setup.js,
// crisisRows), so the row lies in line with the board.
export function crisisRowLayout(team, type, codes, drawn = false) {
  const { placed, width } = placeRow(
    [codes.map((code) => ({ code, kind: type, gems: [] }))],
    CRISIS_ROW_LENGTH,
  )
  const x = drawn ? DRAWN_ROW_X : CRISIS_ROW_X[type]
  return placed.map((card) => ({
    ...card,
    x,
    z: (CRISIS_START_Z + width / 2 + card.x) * side(team),
    yaw: CRISIS_CARD_YAW,
  }))
}
