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

export const ROSTER = jarvisData
  .filter(jch => jch.exportCode)
  .map(jch => {
    const m = migrated.get(jch.exportCode)
    return {
      slug: m?.slug || jch.slug,
      name: m?.name || jch.name,
      mctCode: jch.exportCode,
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
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

export function searchCharacters(query) {
  const q = query.toLowerCase().trim()
  if (!q) return []
  return ROSTER.filter(ch =>
    ch.name.toLowerCase().includes(q) || ch.mctCode.startsWith(q)
  )
}

const bySlug = new Map(ROSTER.map(ch => [ch.slug, ch]))

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

// Token keys the tray's "Give" row offers for this character, beyond Activated and Dazed (every
// character gets those, so they are not in characters.json, see migrate-characters.mjs).
export function characterGiveTokens(slug) {
  return bySlug.get(slug)?.tokens ?? []
}

// Token keys this character cannot get (p21). TrayControls.jsx and App.jsx's give handler use this.
export function characterImmune(slug) {
  return bySlug.get(slug)?.immune ?? []
}
