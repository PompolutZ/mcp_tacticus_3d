// Affiliation list built from affiliations.json, the same pattern as tokens/tokens.js. The data comes from
// scripts/migrate-scoreboard.mjs. A VP marker shows the token of its player's affiliation.
import affiliationsData from './affiliations.json'

// Sorted by name, for the Toolbar
export const AFFILIATIONS = Object.entries(affiliationsData)
  .map(([key, a]) => ({ key, ...a }))
  .sort((a, b) => a.name.localeCompare(b.name))

export const DEFAULT_AFFILIATION = 'unaffiliated'
