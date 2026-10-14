// Where the roster cards lie on the table. Plain module, no React, the same as characters/trays.js.
// See docs/features/roster.md, "On the table", and docs/features/setup-game.md, "On the table".

import { TABLE_DEPTH, TABLE_WIDTH } from '../table.js'
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

// Outer z (far from the mat) of roster row 2 for host. Row 2 holds at most 10 tactics, 10 x 2.5" + gaps = 27.7"
// wide, so it is never scaled and always ends here. The squad panel lies past it (tabletools/layout.js).
export const ROSTER_ROWS_OUTER_Z =
  TACTIC_TRAY_OUTER_Z + ROW_GAP + TRAY_CARD_HEIGHT + ROW_GAP + TACTIC_CARD_HEIGHT

const side = (team) => (team === 'host' ? 1 : -1)
// A card faces its owner, the same as a tray card: for host, the image top points to -z
const cardYaw = (team) => (team === 'host' ? 0 : Math.PI)

// The cards of `parsed` (mct.js) for `team`: [{ code, kind, gems, x, z, width, height, yaw }]. Row 1 holds the
// characters, row 2 the Team Tactic cards. The crisis cards lie next to the scoring board (crisisRowLayout).
// Computed for host (+z), then mirrored for guest, the same as the trays: x and z change sign, and the card
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

// The crisis cards of a roster lie next to the scoring board, on the owner's side, until the game setup
// puts the two cards of the mission on the board ends. They are turned the same way as the board and the
// cards on its ends (CrisisCard.jsx): the image top faces the table edge (-x). So each row runs along z,
// parallel to the board. A row starts next to the board end, and its first card is the one nearest to the
// board. The Secure row is the first row, at the table edge. The Extract row lies toward the mat. Between
// the rows is a gap for the deck buttons (GameSetup.jsx).
// The cards drawn from a deck, and at last the card that the mission uses, lie in one row in line with the
// board instead (DRAWN_ROW_X). So the chosen card ends up next to the board end.
// Numbers are for host (+z). Guest is the same at -z: only z changes sign, so the cards read the same way.
const CRISIS_CARD_YAW = Math.PI / 2
// The rows start past the Secure card on the board end. The deck area is as long as a row of 5 cards, the
// most of one type in a roster (docs/features/roster.md, "Terms"). A row of more cards is scaled down to fit.
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
// x of the Use buttons of the drawn cards: next to the cards, on the table-edge side. A turned card
// (crisisRowLayout, facing) is narrower in x, so its button is closer to the board.
export const USE_BUTTON_X = DRAWN_ROW_X - CRISIS_CARD_HEIGHT / 2 - BUTTON_GAP / 2
export const USE_BUTTON_X_TURNED = DRAWN_ROW_X - CRISIS_CARD_WIDTH / 2 - BUTTON_GAP / 2
// A turned row runs along z until this z, 1" from the table edge
const CRISIS_END_Z = TABLE_DEPTH / 2 - TABLE_MARGIN

// z of the middle of the deck area of `team`
export function crisisCenterZ(team) {
  return (CRISIS_START_Z + CRISIS_ROW_LENGTH / 2) * side(team)
}

// The crisis cards `codes` of `type` ('secure' | 'extract') of `team`, in one row:
// [{ code, kind, gems, x, z, width, height, yaw }]. drawn: the cards were drawn from the deck (setup/setup.js,
// crisisRows), so the row lies in line with the board.
// facing: the side that chooses from these cards, or null. A facing row is turned to read upright for that
// side (the same yaw as its roster cards: host 0, guest pi), docs/features/setup-game.md, "Crisis cards". The
// row still runs along z, so the cards are 4.8" long in z, not 2.75". The row is scaled down so that it ends
// before CRISIS_END_Z. x of the row does not change.
export function crisisRowLayout(team, type, codes, drawn = false, facing = null) {
  const x = drawn ? DRAWN_ROW_X : CRISIS_ROW_X[type]
  if (facing) {
    const natural = codes.length * CRISIS_CARD_HEIGHT + Math.max(0, codes.length - 1) * CARD_GAP
    const scale = Math.min(1, (CRISIS_END_Z - CRISIS_START_Z) / natural)
    const width = CRISIS_CARD_WIDTH * scale
    const height = CRISIS_CARD_HEIGHT * scale
    return codes.map((code, i) => ({
      code,
      kind: type,
      gems: [],
      x,
      z: (CRISIS_START_Z + height / 2 + i * (height + CARD_GAP * scale)) * side(team),
      width,
      height,
      yaw: cardYaw(facing),
    }))
  }
  const { placed, width } = placeRow(
    [codes.map((code) => ({ code, kind: type, gems: [] }))],
    CRISIS_ROW_LENGTH,
  )
  return placed.map((card) => ({
    ...card,
    x,
    z: (CRISIS_START_Z + width / 2 + card.x) * side(team),
    yaw: CRISIS_CARD_YAW,
  }))
}
