// Team Tactic card list built from cards.json, the same pattern as tokens/tokens.js.
import cardsData from './cards.json'

// [{ key, id, name }], by name. id is the MCT code.
export const TACTICS = Object.entries(cardsData)
  .map(([key, card]) => ({ key, ...card }))
  .sort((a, b) => a.name.localeCompare(b.name))

export function getTactic(key) {
  return cardsData[key] ?? null
}
