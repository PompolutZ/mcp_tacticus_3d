// Character tray geometry: where a tray sits on the table and how big it is. Plain module, no
// React, the same as table.js and dice/tray.js, so a future headless sim could use it too.
// See docs/characters-hud.md, "Tray layout".

import { TABLE_WIDTH } from '../table.js'
import { TOKEN_SIZE } from '../tokens/files.js'

// The mat is 36" x 36" (MAT_SIZE in Scene.jsx; not exported there, so this repeats the number).
const MAT_SIZE = 36
const MAT_HALF = MAT_SIZE / 2

// Card face images are 1800x1200 px
export const TRAY_CARD_WIDTH = 4.5
export const TRAY_CARD_HEIGHT = TRAY_CARD_WIDTH * (1200 / 1800)
export const TRAY_WIDTH = 5

// Real-size character tokens on the tray (TOKEN_SIZE wide), in rows: the tokens on the character
// above the card, and the character's Give sources below the controls strip. A row holds 6 tokens,
// which fill the tray width exactly: 6 * 0.85 - 0.1 = 5.
const TOKEN_GAP = 0.1
const TOKEN_PITCH = TOKEN_SIZE + TOKEN_GAP
const TOKENS_PER_ROW = Math.floor((TRAY_WIDTH + TOKEN_GAP) / TOKEN_PITCH)
// The longest cToken list in the mod has 8 tokens. With Activated and Dazed, a Give area holds
// up to 10 tokens, so 2 rows. Every tray has both rows, so all trays have the same size.
const GIVE_ROWS = 2

// The parts of a tray, from the mat side to the owner's side: the "On" row of tokens, the card,
// the controls strip (Damage, Power, Flip, Remove, Held, see TrayControls.jsx), and the Give rows.
const ON_DEPTH = TOKEN_SIZE + TOKEN_GAP * 2
export const TRAY_CONTROLS_DEPTH = 1.5
const GIVE_DEPTH = GIVE_ROWS * TOKEN_PITCH + TOKEN_GAP
export const TRAY_DEPTH = ON_DEPTH + TRAY_CARD_HEIGHT + TRAY_CONTROLS_DEPTH + GIVE_DEPTH

// A tray lies just above the table, like a crisis card (see crisis/layout.js, CARD_Y), so it does
// not z-fight with the table top.
export const TRAY_Y = 0.02

// Local z of each part inside the tray group. Local -z is the mat side, which is also the top of
// the card image (see trayYaw). CharacterTray.jsx places the parts with these; trayModelPosition
// below uses the card's z to find the card's center in world space.
const MAT_SIDE_Z = -TRAY_DEPTH / 2
const ON_Z = MAT_SIDE_Z + ON_DEPTH / 2
export const TRAY_CARD_LOCAL_Z = MAT_SIDE_Z + ON_DEPTH + TRAY_CARD_HEIGHT / 2
export const TRAY_CONTROLS_LOCAL_Z = MAT_SIDE_Z + ON_DEPTH + TRAY_CARD_HEIGHT + TRAY_CONTROLS_DEPTH / 2
const GIVE_FIRST_Z = MAT_SIDE_Z + ON_DEPTH + TRAY_CARD_HEIGHT + TRAY_CONTROLS_DEPTH + TOKEN_GAP + TOKEN_SIZE / 2
// Token rows start at the owner's left, as in TTS. That is local -x for both players (see trayYaw).
const FIRST_TOKEN_X = -TRAY_WIDTH / 2 + TOKEN_SIZE / 2

// Local [x, z] of token `index` of the `count` tokens in the "On" row. A new token goes at the end,
// so the others do not move. A character rarely has more than 6 tokens; when it has, the tokens
// move closer and overlap, so the row stays as wide as the tray.
export function trayOnTokenPosition(index, count) {
  const pitch = count > TOKENS_PER_ROW ? (TRAY_WIDTH - TOKEN_SIZE) / (count - 1) : TOKEN_PITCH
  return [FIRST_TOKEN_X + index * pitch, ON_Z]
}

// Local [x, z] of Give source `index`: rows of TOKENS_PER_ROW, the first row next to the controls.
export function trayGiveTokenPosition(index) {
  const row = Math.floor(index / TOKENS_PER_ROW)
  const column = index % TOKENS_PER_ROW
  return [FIRST_TOKEN_X + column * TOKEN_PITCH, GIVE_FIRST_Z + row * TOKEN_PITCH]
}

// Background plate under every part, so a tray stands out from the table (see
// docs/characters-hud.md, "One tray"). Slightly larger than the parts, and just under the card's Y
// (TRAY_Y), so it shows as a border and does not z-fight the card.
const TRAY_BG_MARGIN = 0.3
export const TRAY_BG_WIDTH = TRAY_WIDTH + TRAY_BG_MARGIN * 2
export const TRAY_BG_DEPTH = TRAY_DEPTH + TRAY_BG_MARGIN * 2
export const TRAY_BG_Y = -TRAY_Y / 2 // local offset from the tray group's own Y (TRAY_Y)

// Gap between two background plates next to each other, and between the mat edge and the row.
// Without it, the plates touch and two trays look like one.
const TRAY_GAP = 0.3
// Trays sit 5.9" apart, center to center (5.6" plate + 0.3" gap). A player has one row of trays.
// floor((72 + 0.3) / 5.9) = 12 trays fit in the table width; a row of more goes past the table
// edges. A row of more than 6 trays is wider than the mat, so it goes past the mat corners (see
// docs/characters-hud.md, "Place on the table").
const TRAY_SPACING = TRAY_BG_WIDTH + TRAY_GAP
// Center z of the row, for a player at local +z (see trayPosition, which mirrors this for red).
const ROW_CENTER_Z = MAT_HALF + TRAY_GAP + TRAY_BG_DEPTH / 2

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

// True when a table point { x, z } is on the background plate of a tray at `trayPos` (from
// trayPosition). The plate is symmetric, so a red tray's 180 deg turn does not matter.
export function onTray(trayPos, point) {
  return Math.abs(point.x - trayPos[0]) <= TRAY_BG_WIDTH / 2 && Math.abs(point.z - trayPos[2]) <= TRAY_BG_DEPTH / 2
}

// The card faces its owner: for blue, the top of the image points to -z, the same as a crisis
// card (see CrisisCard.jsx). A red tray is turned by 180 deg around the vertical axis.
export function trayYaw(teamColor) {
  return teamColor === 'blue' ? 0 : Math.PI
}

// Table position for a newly spawned model: standing on the center of the card of its tray at
// `trayPos` (from trayPosition; see docs/characters-hud.md, "Spawn on the card"). y = 0, the table
// top: the tray card is a flat plane with no collider, so the model stands on the table itself
// (CharacterModel.jsx's body origin is the base bottom).
export function trayModelPosition(teamColor, trayPos) {
  const [trayX, , trayZ] = trayPos
  // The card sits toward the mat (TRAY_CARD_LOCAL_Z is negative, local -Z); a red tray is turned
  // 180 deg (trayYaw), so the same offset points the other way in world z.
  const towardMat = teamColor === 'blue' ? TRAY_CARD_LOCAL_Z : -TRAY_CARD_LOCAL_Z
  return [trayX, 0, trayZ + towardMat]
}
