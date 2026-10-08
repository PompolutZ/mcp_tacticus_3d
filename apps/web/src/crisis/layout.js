// Table geometry shared by the crisis cards and their tokens: where the two cards sit next to the
// scoring board, and where a card's supply pile sits. See docs/feature-crisis.md, "Scoring board".

import { BOARD_HALF_LENGTH, BOARD_X } from '../scoreboard/board.js'

// Card face images are 800×1400 px
const IMAGE_WIDTH = 800
const IMAGE_HEIGHT = 1400
export const CARD_WIDTH = 2.75
export const CARD_HEIGHT = CARD_WIDTH * (IMAGE_HEIGHT / IMAGE_WIDTH)
// A card lies just above the table, not on the mat
export const CARD_Y = 0.02
// Crisis tokens are 1" circles (CrisisToken.jsx, RADIUS)
export const CRISIS_TOKEN_SIZE = 1

// The scoring board (scoreboard/board.js) is centered on z = 0 and covers z = -9..9. A card lies at each
// end of it. The card is turned so that its long side lies along the end of the board, and its text
// reads the same way as the board: the image top faces the table edge (-x), the bottom faces the mat.
const CARD_GAP = 0.5

export const CARD_X = BOARD_X
// The mod has no automated placement for the crisis cards; players place them by hand on a real
// table, and no mod script sets a table position for them. This puts Secure at the blue side (+z)
// and Extract at the red side (-z), which was not checked against the mod.
export const CARD_Z = {
  secure: BOARD_HALF_LENGTH + CARD_GAP + CARD_WIDTH / 2,
  extract: -(BOARD_HALF_LENGTH + CARD_GAP + CARD_WIDTH / 2),
}

// Supply pile of a Source card: one token below the card text, between the card and the mat edge
// (x = -18). It is centered on the card's z.
const SUPPLY_GAP = 0.3

export function supplyPilePosition(type) {
  return { x: CARD_X + CARD_HEIGHT / 2 + SUPPLY_GAP + CRISIS_TOKEN_SIZE / 2, z: CARD_Z[type] }
}
