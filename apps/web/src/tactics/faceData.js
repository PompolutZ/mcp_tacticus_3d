import cardsData from './cards.json'
import { getTactic } from './cards.js'

// The text of the Team Tactic faces (tactics/TacticFace.jsx). The data file is big, so it loads on
// the first need, as its own chunk.

// True for a card whose face is drawn from Jarvis data: every Team Tactic card and every Infinity Gem
// (all of cards.json)
export const isFaceKey = (key) => Object.hasOwn(cardsData, key)

let text = null
let promise = null

// Promise of { key: entry }, loaded once
export function loadFaceText() {
  promise ??= import('./jarvis-tactics-text.json').then((m) => {
    text = m.default
    return text
  })
  return promise
}

const cards = new Map()

// The entry of a card with its name, or null when the text is not loaded yet or the card has none. The same
// object for the same key.
export function faceCard(key) {
  const entry = text?.[key]
  if (!entry) return null
  if (!cards.has(key)) cards.set(key, { ...entry, name: getTactic(key)?.name ?? key })
  return cards.get(key)
}

// True once loadFaceText has finished
export const faceTextLoaded = () => text !== null

// All keys that have text, sorted by name. Only after loadFaceText.
export const faceKeys = () =>
  Object.keys(text ?? {}).sort((a, b) =>
    (getTactic(a)?.name ?? a).localeCompare(getTactic(b)?.name ?? b),
  )
