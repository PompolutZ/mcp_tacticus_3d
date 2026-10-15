// Team Tactic card list built from cards.json, the same pattern as tokens/tokens.js.
import cardsData from './cards.json'
import jarvisData from './jarvis-rows.json'

// The first Jarvis row of each code: [{ code, key, name, slug, gem }]. Jarvis lists some codes twice
// (reprints, and gems with other slugs); the first row is the card. key: the key in cards.json, or null
// when the app has no files for it. gem: Infinity Gem. Jarvis tactic rows have no replacedBy.
const keyOfCode = new Map(Object.entries(cardsData).map(([key, card]) => [card.id, key]))
const rowsByCode = new Map()
const slugsByCode = new Map()
for (const row of jarvisData) {
  if (!row.exportCode) continue
  slugsByCode.set(row.exportCode, [...(slugsByCode.get(row.exportCode) ?? []), row.slug])
  if (rowsByCode.has(row.exportCode)) continue
  rowsByCode.set(row.exportCode, {
    code: row.exportCode,
    key: keyOfCode.get(row.exportCode) ?? null,
    name: row.name,
    slug: row.slug,
    gem: Boolean(row.isInfinityGem),
  })
}
export const TACTIC_ROWS = [...rowsByCode.values()]

// The Jarvis slugs of a code. A code with two Jarvis rows gives both slugs.
export const tacticSlugsOf = (code) => slugsByCode.get(code) ?? []

// [{ key, id, name, gem }], Team Tactic cards by name, then the Infinity Gems by name. id is the MCT code.
// A gem is not played from a tray: it is attached to a character (docs/features/character-trays.md,
// "Attached cards").
export const TACTICS = Object.entries(cardsData)
  .map(([key, card]) => ({ key, ...card, gem: rowsByCode.get(card.id)?.gem ?? false }))
  .sort((a, b) => a.gem - b.gem || a.name.localeCompare(b.name))

export function getTactic(key) {
  return cardsData[key] ?? null
}
