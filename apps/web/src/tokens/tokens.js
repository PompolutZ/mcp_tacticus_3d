// Token list built from tokens.json, the same pattern as crisis/cards.js. The 'counter' group
// ("1 Damage", "1 Power") is in the list: the Library has it for piles. "1 Power" is also the icon
// of the tray's Power counter, see TrayControls.jsx.
import tokensData from './tokens.json'
import { TOKEN_SIZE } from './files.js'

export const TOKENS = Object.entries(tokensData)
  .map(([key, t]) => ({ key, ...t }))
  .sort((a, b) => a.name.localeCompare(b.name))

// Width of the token on the table, in inches: the size that migrate-tokens.mjs wrote to tokens.json
// (tLarge circles are 1"), else TOKEN_SIZE. A tray keeps TOKEN_SIZE for every token. Here and not in
// files.js, because the migrate script imports files.js and cannot import the JSON.
export const tokenSize = (key) => tokensData[key]?.size ?? TOKEN_SIZE

export function getToken(key) {
  return tokensData[key] ?? null
}

// A character has each special condition, Activated or Dazed at most once (p17). Every other
// token (character, tactic) counts up, see docs/characters-hud.md, "Players apply the rules".
export function isCappedToken(key) {
  const group = tokensData[key]?.group
  return group === 'condition' || group === 'status'
}
