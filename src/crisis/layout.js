// Table geometry shared by the crisis cards and their tokens: where the two cards sit next to the
// scoring board, and where a card's supply column sits. See docs/feature-crisis.md, "Scoring board".

// Card face images are 800×1400 px
const IMAGE_WIDTH = 800
const IMAGE_HEIGHT = 1400
export const CARD_WIDTH = 2.75
export const CARD_HEIGHT = CARD_WIDTH * (IMAGE_HEIGHT / IMAGE_WIDTH)
// A card lies just above the table, not on the mat
export const CARD_Y = 0.02

// The scoring board (a later feature) is 18" × 8" at TTS (-23.1, 0), so x = -23.1 and it covers
// z = -9..9.
const BOARD_X = -23.1
const BOARD_HALF_DEPTH = 9
const CARD_GAP = 0.5

export const CARD_X = BOARD_X
// The mod has no automated placement for the crisis cards; players place them by hand on a real
// table, and no mod script sets a table position for them. This puts Secure at the blue side (+z)
// and Extract at the red side (-z), which was not checked against the mod.
export const CARD_Z = {
  secure: BOARD_HALF_DEPTH + CARD_GAP + CARD_HEIGHT / 2,
  extract: -(BOARD_HALF_DEPTH + CARD_GAP + CARD_HEIGHT / 2),
}

// Supply column: further from the mat than the card, one column per card type, 1.5" apart and
// centered on the card's z.
export const SUPPLY_X = -27
const SUPPLY_SPACING = 1.5

export function supplyPosition(type, index, count) {
  return { x: SUPPLY_X, z: CARD_Z[type] + (index - (count - 1) / 2) * SUPPLY_SPACING }
}
