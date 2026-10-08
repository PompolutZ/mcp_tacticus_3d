// Character tray geometry: where a tray sits on the table and how big it is. Plain module, no
// React, the same as table.js and dice/tray.js, so a future headless sim could use it too.
// See docs/characters-hud.md, "Tray layout".

import { TACTIC_TRAY_OUTER_Z } from '../tactics/layout.js'
import { TOKEN_SIZE } from '../tokens/files.js'

// Card face images are 1800x1200 px
export const TRAY_CARD_WIDTH = 4.5
export const TRAY_CARD_HEIGHT = TRAY_CARD_WIDTH * (1200 / 1800)
export const TRAY_WIDTH = 5

// Real-size character tokens (TOKEN_SIZE wide), in rows: the tokens on the character above the
// card, and the character's Give sources on the table next to the tray. A row holds 6 tokens,
// which fill the tray width exactly: 6 * 0.85 - 0.1 = 5.
const TOKEN_GAP = 0.1
const TOKEN_PITCH = TOKEN_SIZE + TOKEN_GAP
const TOKENS_PER_ROW = Math.floor((TRAY_WIDTH + TOKEN_GAP) / TOKEN_PITCH)
// The longest cToken list in the mod has 8 tokens. With Activated and Dazed, a character has up to
// 10 Give sources, so 2 rows.

// The parts of a tray, from the mat side to the owner's side: the "On" row of tokens, the card,
// and the controls strip (Damage, Power, Flip, Remove, Held, see TrayControls.jsx). The Give
// sources are not part of the tray: they lie on the table on the owner's side of it.
const ON_DEPTH = TOKEN_SIZE + TOKEN_GAP * 2
export const TRAY_CONTROLS_DEPTH = 1.5
export const TRAY_DEPTH = ON_DEPTH + TRAY_CARD_HEIGHT + TRAY_CONTROLS_DEPTH

// A tray lies just above the table, like a crisis card (see crisis/layout.js, CARD_Y), so it does
// not z-fight with the table top.
export const TRAY_Y = 0.02

// Local z of each part inside the tray group. Local -z is the mat side, which is also the top of
// the card image (see trayYaw). CharacterTray.jsx places the parts with these; trayModelPosition
// below uses the card's z to find the card's center in world space.
const MAT_SIDE_Z = -TRAY_DEPTH / 2
const ON_Z = MAT_SIDE_Z + ON_DEPTH / 2
const TRAY_CARD_LOCAL_Z = MAT_SIDE_Z + ON_DEPTH + TRAY_CARD_HEIGHT / 2
const TRAY_CONTROLS_LOCAL_Z = MAT_SIDE_Z + ON_DEPTH + TRAY_CARD_HEIGHT + TRAY_CONTROLS_DEPTH / 2

// A character whose second form has its own card (see docs/characters-hud.md, "Second forms") has
// that card under the first one, as in TTS. Every part after the first card moves toward the owner
// by this much, so the tray grows toward the owner and its mat side stays in line with the other
// trays. `cards` below is the number of cards on the tray, 1 or 2.
const TRAY_CARD_PITCH = TRAY_CARD_HEIGHT + TOKEN_GAP
const extraDepth = cards => (cards - 1) * TRAY_CARD_PITCH

// Local z of the center of card `card` (from 1)
export function trayCardLocalZ(card) {
  return TRAY_CARD_LOCAL_Z + extraDepth(card)
}

export function trayControlsLocalZ(cards) {
  return TRAY_CONTROLS_LOCAL_Z + extraDepth(cards)
}
// Token rows start at the owner's left, as in TTS. That is local -x for both players (see trayYaw).
const FIRST_TOKEN_X = -TRAY_WIDTH / 2 + TOKEN_SIZE / 2

// Local [x, z] of token `index` of the `count` tokens in the "On" row. A new token goes at the end,
// so the others do not move. A character rarely has more than 6 tokens; when it has, the tokens
// move closer and overlap, so the row stays as wide as the tray.
export function trayOnTokenPosition(index, count) {
  const pitch = count > TOKENS_PER_ROW ? (TRAY_WIDTH - TOKEN_SIZE) / (count - 1) : TOKEN_PITCH
  return [FIRST_TOKEN_X + index * pitch, ON_Z]
}

// An objective token that the character holds (an Extract token, see docs/characters-hud.md, "Hold
// and drop") lies on the card, as in TTS. Its place is stored in tray-local [x, z], so it moves with
// the tray. The default place is the character art: on every card, the art fills the left column
// below the stat box, about the left 26% of the width and the bottom 65% of the height. HELD_ART is
// its center, as a fraction of the card width (u, from the left) and height (v, from the top).
const HELD_ART = { u: 0.13, v: 0.67 }
// A crisis token is a 1" circle (CrisisToken.jsx, RADIUS).
const HELD_RADIUS = 0.5
// Each next token in the default place is this far toward the card top, so the tokens under it show.
const HELD_STEP = 0.4

// Tray-local [x, z] of card point (u, v). The card image top is local -z (see trayYaw).
function cardPoint(u, v) {
  return [(u - 0.5) * TRAY_CARD_WIDTH, TRAY_CARD_LOCAL_Z + (v - 0.5) * TRAY_CARD_HEIGHT]
}

// Moves a tray-local [x, z] so that the whole token lies on the card.
function clampToCard([x, z]) {
  const maxX = TRAY_CARD_WIDTH / 2 - HELD_RADIUS
  const maxZ = TRAY_CARD_HEIGHT / 2 - HELD_RADIUS
  return [
    Math.max(-maxX, Math.min(x, maxX)),
    TRAY_CARD_LOCAL_Z + Math.max(-maxZ, Math.min(z - TRAY_CARD_LOCAL_Z, maxZ)),
  ]
}

// Tray-local [x, z] of the default place of a newly held token, when the character already holds
// `heldCount` tokens.
export function trayHeldDefault(heldCount) {
  const [x, z] = cardPoint(HELD_ART.u, HELD_ART.v)
  return clampToCard([x, z - heldCount * HELD_STEP])
}

// Tray-local [x, z] of the table point { x, z } on the tray at `trayPos`. A red tray is turned
// 180 deg (trayYaw), so its local axes point the other way in world x and z.
function trayLocal(teamColor, trayPos, point) {
  const side = teamColor === 'blue' ? 1 : -1
  return [(point.x - trayPos[0]) * side, (point.z - trayPos[2]) * side]
}

// Tray-local [x, z] of the table point { x, z } on the tray at `trayPos`, moved onto the first
// card. A held token always lies on the first card, also on a tray with two cards.
export function trayHeldLocal(teamColor, trayPos, point) {
  return clampToCard(trayLocal(teamColor, trayPos, point))
}

// Table [x, z] of tray-local `local` on the tray at `trayPos`. The inverse of trayLocal.
function trayWorld(teamColor, trayPos, local) {
  const side = teamColor === 'blue' ? 1 : -1
  return [trayPos[0] + local[0] * side, trayPos[2] + local[1] * side]
}

// Table [x, z] of a held token's tray-local place. The inverse of trayHeldLocal.
export function trayHeldWorld(teamColor, trayPos, local) {
  return trayWorld(teamColor, trayPos, local)
}

// Card point (u, v) of tray-local `local`, as fractions of the card width and height, for the tray
// popup (TrayPopup.jsx). The inverse of cardPoint.
export function trayHeldCardPoint(local) {
  return { u: local[0] / TRAY_CARD_WIDTH + 0.5, v: (local[1] - TRAY_CARD_LOCAL_Z) / TRAY_CARD_HEIGHT + 0.5 }
}

// Token diameter as a fraction of the card width, for the tray popup.
export const HELD_SIZE_U = (HELD_RADIUS * 2) / TRAY_CARD_WIDTH

// Background plate under every part, so a tray stands out from the table (see
// docs/characters-hud.md, "One tray"). Slightly larger than the parts, and just under the card's Y
// (TRAY_Y), so it shows as a border and does not z-fight the card.
const TRAY_BG_MARGIN = 0.3
export const TRAY_BG_WIDTH = TRAY_WIDTH + TRAY_BG_MARGIN * 2
const TRAY_BG_DEPTH = TRAY_DEPTH + TRAY_BG_MARGIN * 2
export const TRAY_BG_Y = -TRAY_Y / 2 // local offset from the tray group's own Y (TRAY_Y)

// Depth and local center z of the background plate of a tray with `cards` cards
export function trayPlate(cards) {
  return { depth: TRAY_BG_DEPTH + extraDepth(cards), z: extraDepth(cards) / 2 }
}

// Gap between two background plates next to each other, between the tactic tray and the row, and
// between the plate and the Give sources. Without it, the plates touch and two trays look like
// one, and the sources look like part of the tray.
const TRAY_GAP = 0.3
const GIVE_FIRST_Z = TRAY_BG_DEPTH / 2 + TRAY_GAP + TOKEN_SIZE / 2

// Local [x, z] of Give source `index`: rows of TOKENS_PER_ROW on the table, the first row next to
// the plate's owner-side edge.
export function trayGiveTokenPosition(index, cards) {
  const row = Math.floor(index / TOKENS_PER_ROW)
  const column = index % TOKENS_PER_ROW
  return [FIRST_TOKEN_X + column * TOKEN_PITCH, GIVE_FIRST_Z + extraDepth(cards) + row * TOKEN_PITCH]
}

// Trays sit 5.9" apart, center to center (5.6" plate + 0.3" gap). A player has one row of trays.
// floor((72 + 0.3) / 5.9) = 12 trays fit in the table width; a row of more goes past the table
// edges. A row of more than 6 trays is wider than the mat, so it goes past the mat corners (see
// docs/characters-hud.md, "Place on the table").
const TRAY_SPACING = TRAY_BG_WIDTH + TRAY_GAP
// Center z of the row, for a player at local +z (see trayPosition, which mirrors this for red). The
// row lies past the player's tactic tray, as in TTS: mat, tactic tray, character trays (see
// docs/feature-team-tactic-cards.md, "Tactic tray").
const ROW_CENTER_Z = TACTIC_TRAY_OUTER_Z + TRAY_GAP + TRAY_BG_DEPTH / 2

// Table position of tray `index` (from 0, in spawn order) of a player who has `count` trays. The
// row is centered on the middle line of the table (x = 0), the same as TTS (arrangeTrays in the
// Red Tray Spawner): one tray sits on the line, two trays sit one on each side of it, and so on.
// So the whole row moves when the player adds or removes a character (see layoutTrays and
// Scene.jsx, which moves the models that stand on their tray). The first tray is on the owner's
// left.
export function trayPosition(teamColor, index, count) {
  // Local x, before mirroring: grows toward the owner's right.
  const x = (index - (count - 1) / 2) * TRAY_SPACING
  // Blue sits at +z, red at -z. Mirroring x and z the same way gives red the same "owner's left"
  // order from its own seat.
  const side = teamColor === 'blue' ? 1 : -1
  return [x * side, TRAY_Y, ROW_CENTER_Z * side]
}

// Tray position of every character: character id -> [x, y, z]. A tray's index is its character's
// place in spawn order (the order of `characters`) among the characters of the same player. So a
// removed character's tray leaves the row, and the trays after it move up one place.
export function layoutTrays(characters) {
  const counts = {}
  for (const ch of characters) counts[ch.teamColor] = (counts[ch.teamColor] ?? 0) + 1
  const next = {}
  const positions = new Map()
  for (const ch of characters) {
    const index = next[ch.teamColor] ?? 0
    next[ch.teamColor] = index + 1
    positions.set(ch.id, trayPosition(ch.teamColor, index, counts[ch.teamColor]))
  }
  return positions
}

// True when a table point { x, z } is on the background plate of a tray with `cards` cards at
// `trayPos` (from trayPosition).
export function onTray(teamColor, trayPos, point, cards) {
  const [x, z] = trayLocal(teamColor, trayPos, point)
  const plate = trayPlate(cards)
  return Math.abs(x) <= TRAY_BG_WIDTH / 2 && Math.abs(z - plate.z) <= plate.depth / 2
}

// True when a table point { x, z } is on the plate of the tray at `trayPos`, or on the table on the
// owner's side of it, as wide as the plate: the place of the Give sources and of a spare model
// (traySpareModelPosition). A model there moves with the tray (see Scene.jsx).
export function inTrayArea(teamColor, trayPos, point) {
  const [x, z] = trayLocal(teamColor, trayPos, point)
  return Math.abs(x) <= TRAY_BG_WIDTH / 2 && z >= -TRAY_BG_DEPTH / 2
}

// The card faces its owner: for blue, the top of the image points to -z, the same as a crisis
// card (see CrisisCard.jsx). A red tray is turned by 180 deg around the vertical axis.
export function trayYaw(teamColor) {
  return teamColor === 'blue' ? 0 : Math.PI
}

// Table position for a newly spawned model: standing on the center of card `card` of its tray at
// `trayPos` (from trayPosition; see docs/characters-hud.md, "Spawn on the card"). y = 0, the table
// top: the tray card is a flat plane with no collider, so the model stands on the table itself
// (CharacterModel.jsx's body origin is the base bottom).
export function trayModelPosition(teamColor, trayPos, card = 1) {
  const [x, z] = trayWorld(teamColor, trayPos, [0, trayCardLocalZ(card)])
  return [x, 0, z]
}

// Table position for the model of a second form that has no card of its own (Hulkbuster's Iron
// Man, see docs/characters-hud.md, "Second forms"): on the table past the last row of the
// `giveCount` Give sources, in the middle of the tray width. The base of radius `baseRadius`
// starts TRAY_GAP after the tokens.
export function traySpareModelPosition(teamColor, trayPos, cards, giveCount, baseRadius) {
  const rows = Math.max(1, Math.ceil(giveCount / TOKENS_PER_ROW))
  const [, lastRowZ] = trayGiveTokenPosition((rows - 1) * TOKENS_PER_ROW, cards)
  const [x, z] = trayWorld(teamColor, trayPos, [0, lastRowZ + TOKEN_SIZE / 2 + TRAY_GAP + baseRadius])
  return [x, 0, z]
}
