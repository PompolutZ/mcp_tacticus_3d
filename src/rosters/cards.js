// Find an MCT code in the Jarvis data: kind, name, image files or null, model or not.
// See docs/feature-roster.md, "Data" and "Cards without files".
import { CHARACTERS } from '../characters/characters.js'
import { characterCard } from '../characters/files.js'
import tacticsData from '../tactics/jarvis-tactics-cards.json'
import tacticFiles from '../tactics/cards.json'
import { tacticCardBack, tacticCardFace } from '../tactics/files.js'
import crisisData from '../crisis/jarvis-crisis-cards.json'
import crisisFiles from '../crisis/cards.json'
import { crisisCardFace } from '../crisis/files.js'
import { parseRoster } from './mct.js'

// Three tactic ids in cards.json lost their leading zero (1430206), so pad them to 8 digits.
const idToKey = files =>
  new Map(Object.entries(files).map(([key, card]) => [card.id.padStart(8, '0'), key]))
const tacticKeys = idToKey(tacticFiles)
const crisisKeys = idToKey(crisisFiles)

// code -> { code, kind, name, image, back, model }. Each code once. back: the image of the other side, for
// the flip in the roster popup. null when the app has no image, or when the other side is the same for
// every card of the kind: the back of a crisis card shows only its type.
const cards = new Map()

for (const ch of CHARACTERS) {
  cards.set(ch.mctCode, {
    code: ch.mctCode,
    kind: 'character',
    name: ch.name,
    image: ch.available ? characterCard(ch.slug, 'healthy') : null,
    back: ch.available ? characterCard(ch.slug, 'injured') : null,
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
    back: key ? tacticCardBack(key) : null,
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
    back: null,
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

// Background of a card without an image, on the table (RosterCards.jsx) and in the roster popup
export const PLATE_COLORS = { character: '#3a4658', tactic: '#4a3f5c', secure: '#3d5a4a', extract: '#5c4a3d' }

// The tabs of the roster popup (RosterPopup.jsx), in order, and the tab of each card kind
export const ROSTER_TABS = [
  { key: 'characters', label: 'Characters' },
  { key: 'tactics', label: 'Tactic cards' },
  { key: 'crisis', label: 'Crisis cards' },
]
export const TAB_OF_KIND = { character: 'characters', tactic: 'tactics', secure: 'crisis', extract: 'crisis' }

// The cards of each popup tab: { characters, tactics, crisis } → [{ code, kind, gems }]. The order is the
// order of rosterLayout (layout.js), so the n-th card of a kind on the table is the n-th card of its tab.
export function rosterTabs(parsed) {
  const cards = (codes, kind) => codes.map(code => ({ code, kind, gems: [] }))
  return {
    characters: parsed.characters.map(ch => ({ code: ch.code, kind: 'character', gems: ch.gems })),
    tactics: cards(parsed.tactics, 'tactic'),
    crisis: [...cards(parsed.secure, 'secure'), ...cards(parsed.extract, 'extract')],
  }
}
