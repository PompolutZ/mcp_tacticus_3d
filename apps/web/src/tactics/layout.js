// Tactic tray geometry: where each player's Team Tactic cards lie on the table. Plain module, no
// React, the same as characters/trays.js. See docs/feature-team-tactic-cards.md, "Tactic tray".

import { MAT_SIZE } from '../table.js'

const MAT_HALF = MAT_SIZE / 2

// A real card is poker size. The face images are about 720 x 1040 px, so the image is 3% shorter on
// the table than in the file.
export const TACTIC_CARD_WIDTH = 2.5
export const TACTIC_CARD_HEIGHT = 3.5

// 5 slots in one row, as the snap points of the TTS "Blue Tactic Tray": about 3.09 apart in local x,
// with the tray scale of 1.15
export const TACTIC_SLOTS = 5
const SLOT_PITCH = 3.55
// The plate is this much larger than the slots on every side, the same margin as a character tray's
// plate (trays.js, TRAY_BG_MARGIN)
const PLATE_MARGIN = 0.3
export const TACTIC_PLATE_WIDTH =
  (TACTIC_SLOTS - 1) * SLOT_PITCH + TACTIC_CARD_WIDTH + PLATE_MARGIN * 2
export const TACTIC_PLATE_DEPTH = TACTIC_CARD_HEIGHT + PLATE_MARGIN * 2
// Gap between the mat edge and the plate, the same as between the mat and a character tray row
const MAT_GAP = 0.3
// Center z of the tray of a player at +z (blue). Red mirrors it.
const TRAY_CENTER_Z = MAT_HALF + MAT_GAP + TACTIC_PLATE_DEPTH / 2
// Distance of the plate's outer edge from the table center. The character tray row starts past it
// (trays.js, ROW_CENTER_Z).
export const TACTIC_TRAY_OUTER_Z = TRAY_CENTER_Z + TACTIC_PLATE_DEPTH / 2

// Cards and the plate lie just above the table, the same as a character tray (trays.js, TRAY_Y). The
// plate is half as high, so the cards do not z-fight with it.
export const TACTIC_CARD_Y = 0.02
export const TACTIC_PLATE_Y = 0.01

const side = (team) => (team === 'blue' ? 1 : -1)

// Table position { x, z } of the tactic tray of `team`
export function tacticTrayPosition(team) {
  return { x: 0, z: TRAY_CENTER_Z * side(team) }
}

// A card faces its owner: for blue, the top of the image points to -z, the same as a character tray
// card (trays.js, trayYaw). A red card is turned 180 deg.
export function tacticCardYaw(team) {
  return team === 'blue' ? 0 : Math.PI
}

// Table position { x, z } of slot `index` of the tray of `team`, numbered from the owner's left, the
// same as the character trays. Index 5 and up continue the row past the owner's right end of the plate.
export function tacticSlotPosition(team, index) {
  const x = (index - (TACTIC_SLOTS - 1) / 2) * SLOT_PITCH
  return { x: x * side(team), z: TRAY_CENTER_Z * side(team) }
}

// The team whose plate is under the table point { x, z }, or null
export function tacticTrayAt(point) {
  for (const team of ['blue', 'red']) {
    const tray = tacticTrayPosition(team)
    if (
      Math.abs(point.x - tray.x) <= TACTIC_PLATE_WIDTH / 2 &&
      Math.abs(point.z - tray.z) <= TACTIC_PLATE_DEPTH / 2
    )
      return team
  }
  return null
}

// A slot is free when no card center lies inside its outline. cards: [{ id, x, z }]. ignoreId: a card
// that does not count, for example the one that is dragged.
function slotFree(slot, cards, ignoreId) {
  return !cards.some(
    (card) =>
      card.id !== ignoreId &&
      Math.abs(card.x - slot.x) < TACTIC_CARD_WIDTH / 2 &&
      Math.abs(card.z - slot.z) < TACTIC_CARD_HEIGHT / 2,
  )
}

// Position of the first free slot of `team`, from the owner's left. When the 5 slots are full, the
// first free place past the plate's right end.
export function firstFreeSlot(team, cards) {
  for (let index = 0; ; index++) {
    const slot = tacticSlotPosition(team, index)
    if (slotFree(slot, cards)) return slot
  }
}

// Position of the free slot of `team`'s plate nearest to the table point { x, z }, or null when all 5
// are full. ignoreId: the card that is dropped, so its own slot counts as free.
export function nearestFreeSlot(team, point, cards, ignoreId) {
  let best = null
  let bestDistance = Infinity
  for (let index = 0; index < TACTIC_SLOTS; index++) {
    const slot = tacticSlotPosition(team, index)
    const distance = Math.hypot(slot.x - point.x, slot.z - point.z)
    if (distance < bestDistance && slotFree(slot, cards, ignoreId)) {
      best = slot
      bestDistance = distance
    }
  }
  return best
}
