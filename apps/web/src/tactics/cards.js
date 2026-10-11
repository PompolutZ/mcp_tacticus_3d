// Team Tactic card list built from cards.json, the same pattern as tokens/tokens.js.
import cardsData from './cards.json'
import jarvisData from './jarvis-tactics-cards.json'

// cards.json also holds the Infinity Gem cards (same files). They are not Team Tactic cards.
const GEM_CODES = new Set(
  jarvisData.filter((row) => row.isInfinityGem).map((row) => row.exportCode),
)

// [{ key, id, name }], by name, without the gems. id is the MCT code.
export const TACTICS = Object.entries(cardsData)
  .filter(([, card]) => !GEM_CODES.has(card.id.padStart(8, '0')))
  .map(([key, card]) => ({ key, ...card }))
  .sort((a, b) => a.name.localeCompare(b.name))

export function getTactic(key) {
  return cardsData[key] ?? null
}
