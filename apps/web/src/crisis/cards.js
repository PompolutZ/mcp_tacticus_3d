// Card list built from cards.json, with the Jarvis name where one is found. Also the token rules:
// small functions that read the flags the mod sets on each token in cards.json. The app does not
// hard-code these per card, so a new migrated card gets the same rules for free.

import cardsData from './cards.json'
import jarvisData from './jarvis-crisis-cards.json'
import tokensData from './tokens.json'

// Jarvis has several printings of a card. The current one has replacedBy: null. cards.json keys a
// card by its mod id (the MCT export code), so this maps that id to the current Jarvis printing.
const jarvisById = new Map()
for (const printing of jarvisData) {
  if (printing.replacedBy === null) jarvisById.set(printing.exportCode, printing)
}

// One entry per card, sorted by name. key: the slug in cards.json and in the crisis asset paths.
export const CARDS = Object.entries(cardsData)
  .map(([key, card]) => ({
    key,
    id: card.id,
    name: jarvisById.get(card.id)?.name ?? card.name,
    type: card.type,
    threat: card.threat,
    tokens: card.tokens,
    supply: card.supply ?? null,
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

const cardByKey = new Map(CARDS.map(c => [c.key, c]))

export function cardsOfType(type) {
  return CARDS.filter(c => c.type === type)
}

export function getCard(key) {
  return key ? cardByKey.get(key) ?? null : null
}

// A token can be dragged to a new spot. Locked tokens (most Secure tokens) and flip-only tokens
// (Sources, which snap back to their position when dropped) cannot.
export function canMove(token) {
  return !token.locked && !token.flipOnly
}

// A token can be flipped when the mod gave it a back image.
export function canFlip(token) {
  return Boolean(token.back)
}

// A Zone token (X-Men Infiltrate) shows an Arc and can be turned and measured with the Arc outline.
export function hasArc(token) {
  return token.token === 'secure-zone'
}

// Every Secure token can carry a Control marker and a damage marker, no matter which card it is on.
export function hasMarkers(card) {
  return card.type === 'secure'
}

// tokens.json row of a token image: { name, shape, size }
export function tokenInfo(key) {
  return tokensData[key] ?? null
}
