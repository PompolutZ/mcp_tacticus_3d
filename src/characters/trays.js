// Character tray geometry: where a tray sits on the table and how big it is. Plain module, no
// React, the same as table.js and dice/tray.js, so a future headless sim could use it too.
// See docs/characters-hud.md, "Tray layout".

// The mat is 36" x 36" (MAT_SIZE in Scene.jsx; not exported there, so this repeats the number,
// the same way the row position below is a local constant and not derived from table.js).
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

// Trays sit 5.5" apart, center to center. A row is flush with the mat's width (36"), not the
// whole table, so a tray never sits in a table corner past the mat. floor(36 / 5.5) = 6 trays
// fit in one row (see docs/characters-hud.md, "Place on the table").
export const TRAY_SPACING = 5.5
export const TRAY_COLUMNS = Math.floor(MAT_SIZE / TRAY_SPACING)

// Gap between the mat edge and the first row, and between the first and second row.
const TRAY_GAP = 0.5
// Two rows (12 trays) fit between the mat edge and the table edge (the strip is 12" deep, table.js
// TABLE_DEPTH = 60); a third row would not. See docs/characters-hud.md, "Place on the table".
export const TRAY_ROWS = 2

// Center z of row `row` (0 = next to the mat, 1 = behind it, toward the owner), for a player at
// local +z (see trayPosition, which mirrors this for red).
function rowCenterZ(row) {
  return MAT_HALF + TRAY_GAP + TRAY_DEPTH / 2 + row * (TRAY_DEPTH + TRAY_GAP)
}

// Table position of tray `index` (from 0) of a player. Depends only on `index` (the character's
// `slot`), never on how many characters exist, so a tray never moves when another character spawns
// or is removed. The row fills from the owner's left corner of the mat, in the order of spawn,
// flush with the mat edge; a second row starts behind the first one once it is full (see
// docs/characters-hud.md, "Place on the table").
export function trayPosition(teamColor, index) {
  const row = Math.floor(index / TRAY_COLUMNS) % TRAY_ROWS
  const col = index % TRAY_COLUMNS
  // Local x, before mirroring: flush with the mat's left edge (-MAT_HALF) for the owner, growing
  // toward the owner's right.
  const x = -MAT_HALF + TRAY_WIDTH / 2 + col * TRAY_SPACING
  // Blue sits at +z, red at -z. Mirroring x and z the same way gives red the same "owner's left"
  // order from its own seat.
  const side = teamColor === 'blue' ? 1 : -1
  return [x * side, TRAY_Y, rowCenterZ(row) * side]
}

// The card faces its owner: for blue, the top of the image points to -z, the same as a crisis
// card (see CrisisCard.jsx). A red tray is turned by 180 deg around the vertical axis.
export function trayYaw(teamColor) {
  return teamColor === 'blue' ? 0 : Math.PI
}

// Table position for a newly spawned model: standing on the center of its tray's card (same
// `index`, the character's slot; see docs/characters-hud.md, "Spawn on the card"). y = 0, the
// table top: the tray card is a flat plane with no collider, so the model stands on the table
// itself (CharacterModel.jsx's body origin is the base bottom).
export function trayModelPosition(teamColor, index) {
  const [trayX, , trayZ] = trayPosition(teamColor, index)
  // The card sits toward the mat (TRAY_CARD_LOCAL_Z is negative, local -Z); a red tray is turned
  // 180 deg (trayYaw), so the same offset points the other way in world z.
  const towardMat = teamColor === 'blue' ? TRAY_CARD_LOCAL_Z : -TRAY_CARD_LOCAL_Z
  return [trayX, 0, trayZ + towardMat]
}
