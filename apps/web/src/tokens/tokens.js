// Token list built from tokens.json, the same pattern as crisis/cards.js. The 'counter' group
// ("1 Damage", "1 Power") is in the list: the Library has it for piles. "1 Power" is also the icon
// of the tray's Power counter, see TrayControls.jsx.
import migratedTokens from './tokens.json'
import { AFFILIATION_TOKENS } from './affiliationTokens.js'
import { TOKEN_SIZE } from './files.js'
import { isCollectedEntry } from './collect.js'

// tokens.json is rewritten by migrate-tokens.mjs, so the affiliation tokens are added here, not in the JSON.
const tokensData = { ...migratedTokens, ...AFFILIATION_TOKENS }

export const TOKENS = Object.entries(tokensData)
  .map(([key, t]) => ({ key, ...t }))
  .sort((a, b) => a.name.localeCompare(b.name))

// Keys of the tokens that the Cleanup Phase removes (cleanup: true, from the mod).
export const CLEANUP_KEYS = TOKENS.filter((t) => t.cleanup).map((t) => t.key)

// Width of the token on the table, in inches: the size that migrate-tokens.mjs wrote to tokens.json
// (tLarge circles are 1"), else TOKEN_SIZE. A tray keeps TOKEN_SIZE for every token. Here and not in
// files.js, because the migrate script imports files.js and cannot import the JSON.
export const tokenSize = (key) => tokensData[key]?.size ?? TOKEN_SIZE

export function getToken(key) {
  return tokensData[key] ?? null
}

// A character has each special condition, Activated or Dazed at most once (p17). Every other
// token (character, tactic) counts up, see docs/features/character-trays.md, "Players apply the rules".
export function isCappedToken(key) {
  const group = tokensData[key]?.group
  return group === 'condition' || group === 'status'
}

// A collected token (collect: true): a tactic card collects it in a number on the card or on the table, so a pile of
// it counts, see docs/features/team-tactic-cards.md, "Collected tokens".
export function isCollected(key) {
  return isCollectedEntry(tokensData[key])
}
