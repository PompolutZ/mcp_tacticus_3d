// Character tray geometry: where a tray sits on the table and how big it is. Plain module, no
// React, the same as table.js and dice/tray.js, so a future headless sim could use it too.
// See docs/characters-hud.md, "Tray layout".

import { TABLE_WIDTH } from '../table.js'

// The mat is 36" x 36" (MAT_SIZE in Scene.jsx; not exported there, so this repeats the number).
const MAT_SIZE = 36
const MAT_HALF = MAT_SIZE / 2

// Card face images are 1800x1200 px
export const TRAY_CARD_WIDTH = 4.5
export const TRAY_CARD_HEIGHT = TRAY_CARD_WIDTH * (1200 / 1800)
// The controls strip below the card (Damage, Power, Flip, tokens), on the owner's side of the tray.
export const TRAY_CONTROLS_DEPTH = 2
export const TRAY_WIDTH = 5
export const TRAY_DEPTH = TRAY_CARD_HEIGHT + TRAY_CONTROLS_DEPTH

// A tray lies just above the table, like a crisis card (see crisis/layout.js, CARD_Y), so it does
// not z-fight with the table top.
export const TRAY_Y = 0.02

// The card's local z offset inside the tray group: the controls strip sits on the owner's side,
// so the card sits half that depth toward the opposite edge, which is also the mat side (see
// trayYaw). CharacterTray.jsx uses this for the card mesh; trayModelPosition below uses it to find
// the card's center in world space.
export const TRAY_CARD_LOCAL_Z = -TRAY_CONTROLS_DEPTH / 2

// Background plate under the card and the controls strip, so a tray stands out from the table
// (see docs/characters-hud.md, "One tray"). Slightly larger than the card+controls footprint, and
// just under the card's Y (TRAY_Y), so it shows as a border and does not z-fight the card.
const TRAY_BG_MARGIN = 0.3
export const TRAY_BG_WIDTH = TRAY_WIDTH + TRAY_BG_MARGIN * 2
export const TRAY_BG_DEPTH = TRAY_DEPTH + TRAY_BG_MARGIN * 2
export const TRAY_BG_Y = -TRAY_Y / 2 // local offset from the tray group's own Y (TRAY_Y)

// Gap between two background plates next to each other, between two rows, and between the mat
// edge and the first row. Without it, the plates touch and two trays look like one.
const TRAY_GAP = 0.3
// Trays sit 5.9" apart, center to center (5.6" plate + 0.3" gap). A row holds as many trays as fit
// in the table width: floor((72 + 0.3) / 5.9) = 12. A row of more than 6 trays is wider than the
// mat, so it goes past the mat corners (see docs/characters-hud.md, "Place on the table").
export const TRAY_SPACING = TRAY_BG_WIDTH + TRAY_GAP
export const TRAY_COLUMNS = Math.floor((TABLE_WIDTH + TRAY_GAP) / TRAY_SPACING)
const ROW_SPACING = TRAY_BG_DEPTH + TRAY_GAP
// Two rows fit between the mat edge and the table edge (the strip is 12" deep, table.js
// TABLE_DEPTH = 60): the second plate ends at 29.8". A third row would not fit.
export const TRAY_ROWS = 2

// Center z of row `row` (0 = next to the mat, 1 = behind it, toward the owner), for a player at
// local +z (see trayPosition, which mirrors this for red).
function rowCenterZ(row) {
  return MAT_HALF + TRAY_GAP + TRAY_BG_DEPTH / 2 + row * ROW_SPACING
}

// Table position of tray `index` (from 0, in spawn order) of a player who has `count` trays. Each
// row is centered on the middle line of the table (x = 0), the same as TTS (arrangeTrays in the
// Red Tray Spawner): one tray sits on the line, two trays sit one on each side of it, and so on.
// So the whole row moves when the player adds or removes a character (see layoutTrays and
// Scene.jsx, which moves the models that stand on their tray). The first tray is on the owner's
// left. A second row starts behind the first one when the first one is full.
export function trayPosition(teamColor, index, count) {
  const rowStart = Math.floor(index / TRAY_COLUMNS) * TRAY_COLUMNS
  const row = (rowStart / TRAY_COLUMNS) % TRAY_ROWS
  // Trays in this row: a full row, or the rest in the last row.
  const inRow = Math.min(TRAY_COLUMNS, count - rowStart)
  // Local x, before mirroring: grows toward the owner's right.
  const x = (index - rowStart - (inRow - 1) / 2) * TRAY_SPACING
  // Blue sits at +z, red at -z. Mirroring x and z the same way gives red the same "owner's left"
  // order from its own seat.
  const side = teamColor === 'blue' ? 1 : -1
  return [x * side, TRAY_Y, rowCenterZ(row) * side]
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
