// Tactic tray geometry: where each player's Team Tactic cards lie on the table. Plain module, no
// React, the same as characters/trays.js. See docs/features/team-tactic-cards.md, "Tactic tray".

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
// Center z of the tray of a player at +z (host). Guest mirrors it.
const TRAY_CENTER_Z = MAT_HALF + MAT_GAP + TACTIC_PLATE_DEPTH / 2
// Distance of the plate's outer edge from the table center. The character tray row starts past it
// (trays.js, ROW_CENTER_Z).
export const TACTIC_TRAY_OUTER_Z = TRAY_CENTER_Z + TACTIC_PLATE_DEPTH / 2

// Cards and the plate lie just above the table, the same as a character tray (trays.js, TRAY_Y). The
// plate is half as high, so the cards do not z-fight with it.
export const TACTIC_CARD_Y = 0.02
export const TACTIC_PLATE_Y = 0.01

const side = (team) => (team === 'host' ? 1 : -1)

// Table position { x, z } of the tactic tray of `team`
export function tacticTrayPosition(team) {
  return { x: 0, z: TRAY_CENTER_Z * side(team) }
}

// A card faces its owner: for host, the top of the image points to -z, the same as a character tray
// card (trays.js, trayYaw). A guest card is turned 180 deg.
export function tacticCardYaw(team) {
  return team === 'host' ? 0 : Math.PI
}

// Table position { x, z } of slot `index` of the tray of `team`, numbered from the owner's left, the
// same as the character trays. Index 5 and up continue the row past the owner's right end of the plate.
export function tacticSlotPosition(team, index) {
  const x = (index - (TACTIC_SLOTS - 1) / 2) * SLOT_PITCH
  return { x: x * side(team), z: TRAY_CENTER_Z * side(team) }
}

// The team whose plate is under the table point { x, z }, or null
export function tacticTrayAt(point) {
  for (const team of ['host', 'guest']) {
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

// Token piles of the cards: they lie on the table past the owner's left end of the plate, in a row going
// outward. See docs/features/team-tactic-cards.md, "Token piles".
const PILE_GAP = 0.3
const PILE_PITCH = 1.2
const PILE_RADIUS = 0.5
// Piles in one row. The next ones go in a row behind it, away from the mat, still beside the plate.
const PILES_PER_ROW = 6

// Table position { x, z } of pile place `index` of `team`, numbered from the plate outward
export function tacticPilePlace(team, index) {
  const row = Math.floor(index / PILES_PER_ROW)
  const column = index % PILES_PER_ROW
  const edge = (TACTIC_PLATE_WIDTH / 2 + PILE_GAP + PILE_RADIUS + column * PILE_PITCH) * side(team)
  // The owner's left is -x for host and +x for guest, as for the slots
  const slot = tacticSlotPosition(team, 0)
  return { x: -edge, z: slot.z + row * PILE_PITCH * side(team) }
}

// `count` pile places of `team` that no pile of `piles` ([{ x, z }]) lies on, in order. A place is taken
// when a pile center is closer than PILE_PITCH / 2, so a Library add after the squad gets the next place.
export function freePilePlaces(team, piles, count) {
  const places = []
  const taken = [...piles]
  for (let index = 0; places.length < count; index++) {
    const place = tacticPilePlace(team, index)
    if (taken.some((p) => Math.hypot(p.x - place.x, p.z - place.z) < PILE_PITCH / 2)) continue
    places.push(place)
    taken.push(place)
  }
  return places
}

// The token piles for new tactic cards ([{ id, key, team }]): one pile per token of each card, in the
// order of the cards, on the first free places beside the owner's tray. `card` links a pile to its card.
// piles: the piles on the table now. tokensOf(key): the token keys of the tactic card `key`.
export function cardPiles(cards, piles, tokensOf) {
  const result = []
  for (const team of ['host', 'guest']) {
    const wanted = cards
      .filter((card) => card.team === team)
      .flatMap((card) => tokensOf(card.key).map((key) => ({ card: card.id, key })))
    const places = freePilePlaces(team, piles, wanted.length)
    wanted.forEach((pile, i) =>
      result.push({ id: crypto.randomUUID(), ...pile, x: places[i].x, z: places[i].z }),
    )
  }
  return result
}
