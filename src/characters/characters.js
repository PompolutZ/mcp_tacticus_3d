import jarvisData from './jarvis-characters.json'
import migratedData from './characters.json'

function baseName(mm) {
  if (mm <= 35) return 'small'
  if (mm <= 50) return 'medium'
  return 'large'
}

const migrated = new Map()
for (const [slug, ch] of Object.entries(migratedData)) {
  migrated.set(ch.id, { slug, ...ch })
}

// One Library row: the Jarvis character jch (stats), with the migrated character m (files) when
// there is one. mctCode is the row's MCT code.
function rosterEntry(jch, m, mctCode) {
  return {
    slug: m?.slug || jch.slug,
    name: m?.name || jch.name,
    mctCode,
    available: !!m,
    base: m?.base || baseName(jch.baseSize),
    figure: m?.figure || 'model',
    rotation: m?.rotation || 0,
    // Stamina of each stat card side, for the tray's Damage limit (see TrayControls). Jarvis
    // stores it as a string; "?" (Multiple Man's variable stamina) falls back to 0.
    staminaHealthy: Number(jch.statCard.frontSide.stamina) || 0,
    staminaInjured: Number(jch.statCard.backSide.stamina) || 0,
    // Token keys (tokens.json) from the mod's cToken/cImmune, written by migrate-characters.mjs.
    // See docs/characters-hud.md, "Give tokens by drag and drop", and TrayControls.jsx.
    tokens: m?.tokens || [],
    immune: m?.immune || [],
    // Second form: null, or { figure, rotation, base?, name?, portrait?, card? } from
    // characters.json. See docs/characters-hud.md, "Second forms", and models.js.
    transform: m?.transform ?? null,
    // Jarvis name of the second form, for example 'diamond' for Emma Frost, or null. The roster popup
    // uses it as the label of the second card (rosters/cards.js).
    secondForm: jch.secondFormSlug || null,
  }
}

// An alternate sculpt (Mephisto Convention Exclusive) has the MCT code of its main character, so it
// would be a second row for the same character.
const jarvisRows = jarvisData.filter(jch => jch.exportCode && !jch.isAlternateSculpt)
const jarvisCodes = new Set(jarvisRows.map(jch => jch.exportCode))
const jarvisByName = new Map(jarvisRows.map(jch => [jch.name, jch]))

// A migrated character with its own MCT code but no Jarvis entry of its own gets a row too, with the
// stats of the Jarvis character of the same name. The only one now is the second Sentinel MK4
// (00510102): the mod has a row for each of the two sculpts in the box, and Jarvis has one entry. Jarvis
// uses 00510102 in a roster code for the second Sentinel MK4 of a roster.
const extraRows = [...migrated.values()]
  .filter(m => !jarvisCodes.has(m.id) && jarvisByName.has(m.name))
  .map(m => rosterEntry(jarvisByName.get(m.name), m, m.id))

export const CHARACTERS = [
  ...jarvisRows.map(jch => rosterEntry(jch, migrated.get(jch.exportCode), jch.exportCode)),
  ...extraRows,
].sort((a, b) => a.name.localeCompare(b.name) || a.mctCode.localeCompare(b.mctCode))

export function searchCharacters(query) {
  const q = query.toLowerCase().trim()
  if (!q) return []
  return CHARACTERS.filter(ch =>
    ch.name.toLowerCase().includes(q) || ch.mctCode.startsWith(q)
  )
}

const bySlug = new Map(CHARACTERS.map(ch => [ch.slug, ch]))

// Display name of a spawned character (App.jsx stores only its slug as `key`).
export function characterName(slug) {
  return bySlug.get(slug)?.name ?? slug
}

// Stamina of a spawned character's current side: the Damage limit on its tray.
export function characterStamina(slug, side) {
  const ch = bySlug.get(slug)
  if (!ch) return 0
  return side === 'injured' ? ch.staminaInjured : ch.staminaHealthy
}

// Every character's Give sources start with Activated and Dazed. characters.json does not list them:
// the mod spawns them next to every tray (see migrate-characters.mjs).
const ALWAYS_GIVEN = ['activated', 'dazed']

// Token keys of the Give sources next to this character's tray, in order: Activated, Dazed, then
// the tokens of the character (see docs/characters-hud.md, "Give tokens by drag and drop").
export function characterGiveSources(slug) {
  return [...ALWAYS_GIVEN, ...(bySlug.get(slug)?.tokens ?? [])]
}

// Token keys this character cannot get (p21). TrayControls.jsx and App.jsx's give handler use this.
export function characterImmune(slug) {
  return bySlug.get(slug)?.immune ?? []
}
