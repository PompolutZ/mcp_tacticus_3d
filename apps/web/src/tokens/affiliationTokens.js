// The affiliation tokens (group `affiliation`, key `affiliation-<slug>`), one for each affiliation of
// scoreboard/affiliations.json. Plain module without Vite imports, so a node test can import it. See
// docs/features/character-trays.md, "Tokens from the TTS mod".
import affiliationsData from '../scoreboard/affiliations.json' with { type: 'json' }
import { AFFILIATION_PREFIX } from './files.js'

export const affiliationTokenKey = (affiliation) => `${AFFILIATION_PREFIX}${affiliation}`

export const AFFILIATION_TOKENS = Object.fromEntries(
  Object.entries(affiliationsData).map(([key, a]) => [
    affiliationTokenKey(key),
    { name: a.name, group: 'affiliation' },
  ]),
)

// The Give sources `keys` with the token of `affiliation` at `index` (after Activated and Dazed). No
// token for no affiliation (Unaffiliated is an affiliation with its own token). Plain function, so a node test can reach it.
export function withAffiliationSource(keys, affiliation, index) {
  if (!affiliation) return keys
  return [...keys.slice(0, index), affiliationTokenKey(affiliation), ...keys.slice(index)]
}
