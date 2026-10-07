// Find an MCT code in the Jarvis data: kind, name, image file or null, model or not.
// See docs/feature-roster.md, "Data" and "Cards without files".
import { CHARACTERS } from '../characters/characters.js'
import { characterCard } from '../characters/files.js'
import tacticsData from '../tactics/jarvis-tactics-cards.json'
import tacticFiles from '../tactics/cards.json'
import { tacticCardFace } from '../tactics/files.js'
import crisisData from '../crisis/jarvis-crisis-cards.json'
import crisisFiles from '../crisis/cards.json'
import { crisisCardFace } from '../crisis/files.js'
import { parseRoster } from './mct.js'

// Three tactic ids in cards.json lost their leading zero (1430206), so pad them to 8 digits.
const idToKey = files =>
  new Map(Object.entries(files).map(([key, card]) => [card.id.padStart(8, '0'), key]))
const tacticKeys = idToKey(tacticFiles)
const crisisKeys = idToKey(crisisFiles)

// code -> { code, kind, name, image, model }. Each code once.
const cards = new Map()

for (const ch of CHARACTERS) {
  cards.set(ch.mctCode, {
    code: ch.mctCode,
    kind: 'character',
    name: ch.name,
    image: ch.available ? characterCard(ch.slug, 'healthy') : null,
    model: ch.available,
  })
}

// Jarvis lists some codes twice (reprints). The first row is the card.
for (const row of tacticsData) {
  if (!row.exportCode || cards.has(row.exportCode)) continue
  const key = tacticKeys.get(row.exportCode)
  cards.set(row.exportCode, {
    code: row.exportCode,
    kind: 'tactic',
    name: row.name,
    image: key ? tacticCardFace(key) : null,
    model: false,
  })
}

// The current printing of a crisis card has replacedBy: null.
for (const row of crisisData) {
  if (!row.exportCode || row.replacedBy !== null || cards.has(row.exportCode)) continue
  const key = crisisKeys.get(row.exportCode)
  cards.set(row.exportCode, {
    code: row.exportCode,
    kind: row.type === 'Secure' ? 'secure' : 'extract',
    name: row.name,
    image: key ? crisisCardFace(key) : null,
    model: false,
  })
}

export function cardKind(code) {
  return cards.get(code)?.kind ?? null
}

export function rosterCard(code) {
  return cards.get(code) ?? null
}

export function parseRosterText(text) {
  return parseRoster(text, cardKind)
}
