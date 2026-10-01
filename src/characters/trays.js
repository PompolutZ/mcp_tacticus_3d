// Character tray geometry: where a tray sits on the table and how big it is. Plain module, no
// React, the same as table.js and dice/tray.js, so a future headless sim could use it too.
// See docs/characters-hud.md, "Tray layout".

import { TABLE_WIDTH } from '../table.js'

// Card face images are 1800x1200 px
export const TRAY_CARD_WIDTH = 4.5
export const TRAY_CARD_HEIGHT = TRAY_CARD_WIDTH * (1200 / 1800)
// The controls strip below the card (Damage, Power, Flip, tokens), added in a later phase.
export const TRAY_CONTROLS_DEPTH = 2
export const TRAY_WIDTH = 5
export const TRAY_DEPTH = TRAY_CARD_HEIGHT + TRAY_CONTROLS_DEPTH

// A tray lies just above the table, like a crisis card (see crisis/layout.js, CARD_Y), so it does
// not z-fight with the table top.
export const TRAY_Y = 0.02

// Trays sit 5.5" apart, center to center, so a row fits TABLE_WIDTH / 5.5 of them (13 today).
export const TRAY_SPACING = 5.5
export const TRAY_COLUMNS = Math.floor(TABLE_WIDTH / TRAY_SPACING)

// Center z of each player's row of trays, between the bench strip and the table edge: blue trays
// span z = 24.5..29.5, red trays mirror that at z = -29.5..-24.5 (see docs/characters-hud.md,
// "Place on the table").
const TRAY_ROW_Z = 27

// Table position of tray `index` (from 0) of a player. The row fills from the owner's left, in
// the order of spawn, the same as benchPosition in Scene.jsx.
export function trayPosition(teamColor, index) {
  const col = index % TRAY_COLUMNS
  const x = (col - (TRAY_COLUMNS - 1) / 2) * TRAY_SPACING
  // Blue sits at +z, red at -z, mirrored the same way as benchPosition.
  const side = teamColor === 'blue' ? 1 : -1
  return [x * side, TRAY_Y, TRAY_ROW_Z * side]
}

// The card faces its owner: for blue, the top of the image points to -z, the same as a crisis
// card (see CrisisCard.jsx). A red tray is turned by 180 deg around the vertical axis.
export function trayYaw(teamColor) {
  return teamColor === 'blue' ? 0 : Math.PI
}
