// Token list built from tokens.json, the same pattern as crisis/cards.js. The 'counter' group has
// only "1 Power" (the icon of the tray's Power counter, see TrayControls.jsx): not a token a
// player gives to a character, so it is left out here and never reaches the Library or a drag.
import tokensData from './tokens.json'

export const TOKENS = Object.entries(tokensData)
  .filter(([, t]) => t.group !== 'counter')
  .map(([key, t]) => ({ key, ...t }))
  .sort((a, b) => a.name.localeCompare(b.name))

export function getToken(key) {
  return tokensData[key] ?? null
}

// A character has each special condition, Activated or Dazed at most once (p17). Every other
// token (character, tactic) counts up, see docs/characters-hud.md, "Players apply the rules".
export function isCappedToken(key) {
  const group = tokensData[key]?.group
  return group === 'condition' || group === 'status'
}
