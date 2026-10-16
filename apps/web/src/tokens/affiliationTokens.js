// The affiliation tokens (group `affiliation`, key `affiliation-<slug>`), one for each affiliation of
// scoreboard/affiliations.json. Plain module without Vite imports, so a node test can import it. See
// docs/features/character-trays.md, "Tokens from the TTS mod".
import affiliationsData from '../scoreboard/affiliations.json' with { type: 'json' }
import { DEFAULT_AFFILIATION } from '../scoreboard/affiliations.js'
import { AFFILIATION_PREFIX } from './files.js'

export const affiliationTokenKey = (affiliation) => `${AFFILIATION_PREFIX}${affiliation}`

export const AFFILIATION_TOKENS = Object.fromEntries(
  Object.entries(affiliationsData).map(([key, a]) => [
    affiliationTokenKey(key),
    { name: a.name, group: 'affiliation' },
  ]),
)

// The Give sources `keys` with the token of `affiliation` at `index` (after Activated and Dazed). No
// token for no affiliation or Unaffiliated. Plain function, so a node test can reach it.
export function withAffiliationSource(keys, affiliation, index) {
  if (!affiliation || affiliation === DEFAULT_AFFILIATION) return keys
  return [...keys.slice(0, index), affiliationTokenKey(affiliation), ...keys.slice(index)]
}
