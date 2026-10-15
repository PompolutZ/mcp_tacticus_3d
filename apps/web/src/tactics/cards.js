// Team Tactic card list built from cards.json, the same pattern as tokens/tokens.js.
import cardsData from './cards.json'
import jarvisData from './jarvis-rows.json'

// cards.json also holds the Infinity Gem cards (same files). A gem is not played from a tray: it is
// attached to a character (docs/features/character-trays.md, "Attached cards").
const GEM_CODES = new Set(
  jarvisData.filter((row) => row.isInfinityGem).map((row) => row.exportCode),
)

// [{ key, id, name, gem }], Team Tactic cards by name, then the Infinity Gems by name. id is the MCT code.
export const TACTICS = Object.entries(cardsData)
  .map(([key, card]) => ({ key, ...card, gem: GEM_CODES.has(card.id.padStart(8, '0')) }))
  .sort((a, b) => a.gem - b.gem || a.name.localeCompare(b.name))

export function getTactic(key) {
  return cardsData[key] ?? null
}
