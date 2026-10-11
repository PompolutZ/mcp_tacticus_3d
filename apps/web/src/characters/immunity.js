// Immunities of a character, from the superpower names of its Jarvis stat card sides, for example
// "Flight, Immunity [Incinerate, Stun]". See docs/characters-hud.md, "Immunities".

// "Special Conditions" in an immunity means every special condition (rulebook p17, p21). These are
// the condition tokens of tokens.json; the immuneTo* tags of Apocalypse (Immunity [Special Conditions]
// when Injured) in jarvis-characters.json list the same ten. immunity.test.js checks both.
export const SPECIAL_CONDITIONS = [
  'bleed',
  'hex',
  'incinerate',
  'judgement',
  'poison',
  'root',
  'shock',
  'slow',
  'stagger',
  'stun',
]

// Names in the French rows of Jarvis (translatedInCurrentLocale), with the token key that the immuneTo*
// tags of the same row confirm. The English names map by slug.
const FRENCH_NAMES = { secoue: 'shock', hemorragie: 'bleed' }

function nameSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['‘’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Token keys of the "Immunity [...]" part of one superpower name (also "Immune [...]" and
// "Immunité [...]"). A name maps to the key with the same slug. A name with no token stays as a
// slug that is no token key: immunity.test.js lists those, and nothing guesses them.
export function parseImmunity(powerName) {
  const keys = []
  for (const [, list] of powerName.matchAll(/Immun(?:ity|e|ité) \[([^\]]*)\]/g)) {
    for (const name of list.split(',').map((s) => s.trim())) {
      const slug = nameSlug(name)
      if (slug === 'special-conditions') keys.push(...SPECIAL_CONDITIONS)
      else keys.push(FRENCH_NAMES[slug] ?? slug)
    }
  }
  return [...new Set(keys)]
}

// Stat cards of a Jarvis row: the card, and the card of the second form when it has one.
function forms(jch) {
  return [jch.statCard, jch.secondStatCard].filter(Boolean)
}

// Token keys of the immunities of one stat card side ('frontSide' or 'backSide'); [] for no side.
function sideImmunities(card, sideName) {
  const powers = card[sideName]?.superPowers ?? []
  return [...new Set(powers.flatMap((p) => parseImmunity(p.name)))]
}

// Immunities of each form of a Jarvis row: [{ healthy, injured }, ...], token keys.
export function formImmunities(jch) {
  return forms(jch).map((card) => ({
    healthy: sideImmunities(card, 'frontSide'),
    injured: sideImmunities(card, 'backSide'),
  }))
}

// { healthy, injured }: the token keys that every form is immune to on that side. The app does not
// know which form is in use, so only these are refused (docs/characters-hud.md, "Immunities").
export function sharedImmunities(jch) {
  const all = formImmunities(jch)
  const shared = (side) =>
    all.length ? all[0][side].filter((key) => all.every((f) => f[side].includes(key))) : []
  return { healthy: shared('healthy'), injured: shared('injured') }
}
