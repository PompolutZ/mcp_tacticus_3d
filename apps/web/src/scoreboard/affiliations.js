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
// sorted by name. lists: the Jarvis slugs of each character of the squad.
export function squadAffiliations(lists) {
  const counts = new Map()
  for (const list of lists) {
    const keys = new Set(list.map(affiliationKey).filter(Boolean))
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts]
    .filter(([, n]) => n > lists.length / 2)
    .map(([key]) => key)
    .sort((a, b) => affiliationsData[a].name.localeCompare(affiliationsData[b].name))
}

// The affiliation that the app sets with no click: Unaffiliated with no choice, the one choice, or null
// when the player must choose (2 or more)
export function autoAffiliation(keys) {
  if (keys.length === 0) return DEFAULT_AFFILIATION
  return keys.length === 1 ? keys[0] : null
}
