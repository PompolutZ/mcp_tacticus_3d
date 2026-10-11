// Affiliation list built from affiliations.json, the same pattern as tokens/tokens.js. The data comes from
// scripts/migrate-scoreboard.mjs. A VP marker shows the token of its player's affiliation.
import affiliationsData from './affiliations.json' with { type: 'json' }

// Sorted by name, for the Toolbar
export const AFFILIATIONS = Object.entries(affiliationsData)
  .map(([key, a]) => ({ key, ...a }))
  .sort((a, b) => a.name.localeCompare(b.name))

export const DEFAULT_AFFILIATION = 'unaffiliated'

// The name of a token key, for the game setup chips
export const affiliationName = (key) => affiliationsData[key]?.name ?? key

// Jarvis slugs that differ from the token key
const SLUG_ALIASES = { 'uncanny-x-men': 'uncanny-xmen' }

// The token key of a Jarvis affiliation slug, or null when affiliations.json has no token for it
export function affiliationKey(slug) {
  const key = SLUG_ALIASES[slug] ?? slug
  return key in affiliationsData ? key : null
}

// The affiliations of a squad (rule p11): the token keys that more than half of the characters have,
// sorted by name. members: [{ affiliations: [Jarvis slug], rogue }] for each character of the squad. Rogue
// Agent card text: "One character with Rogue Agent counts as an affiliated character during Squad
// building." So a key gets +1 when a rogue member lacks it, and only 1 even with two rogue members.
export function squadAffiliations(members) {
  const sets = members.map((m) => new Set(m.affiliations.map(affiliationKey).filter(Boolean)))
  const candidates = new Set(sets.flatMap((keys) => [...keys]))
  const result = []
  for (const key of candidates) {
    let count = sets.filter((keys) => keys.has(key)).length
    if (members.some((m, i) => m.rogue && !sets[i].has(key))) count += 1
    if (count > members.length / 2) result.push(key)
  }
  return result.sort((a, b) => affiliationsData[a].name.localeCompare(affiliationsData[b].name))
}

// The affiliation that the app sets with no click: Unaffiliated with no choice, the one choice, or null
// when the player must choose (2 or more)
export function autoAffiliation(keys) {
  if (keys.length === 0) return DEFAULT_AFFILIATION
  return keys.length === 1 ? keys[0] : null
}
