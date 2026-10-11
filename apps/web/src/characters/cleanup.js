// Cleanup Phase rules for characters, as plain functions (no JSON, no React). The caller passes the data.
// See docs/plan-cleanup-phase.md, decisions 2, 3 and 4.

import { SPECIAL_CONDITIONS } from './immunity.js'
import { characterOnBoard } from './models.js'

// New character after the Cleanup Phase. cleanupKeys: array or Set of the token keys with cleanup: true
// in tokens.json. Returns the same object when nothing changes.
// All characters lose Activated and the cleanup tokens. A Dazed character also gets Damage 0, the Injured
// side (set, not toggled), and loses Dazed and every special condition. A token with count 0 is not in
// the map, so removing a key deletes it.
export function cleanupCharacter(ch, cleanupKeys) {
  const keys = new Set(cleanupKeys)
  keys.add('activated')
  const dazed = (ch.tokens?.dazed ?? 0) > 0
  if (dazed) {
    keys.add('dazed')
    for (const k of SPECIAL_CONDITIONS) keys.add(k)
  }
  const tokens = {}
  let changed = false
  for (const [key, count] of Object.entries(ch.tokens ?? {})) {
    if (keys.has(key)) changed = true
    else tokens[key] = count
  }
  const flip = dazed && (ch.damage !== 0 || ch.side !== 'injured')
  if (!changed && !flip) return ch
  return flip ? { ...ch, tokens, damage: 0, side: 'injured' } : { ...ch, tokens }
}

// Characters on the board with neither an Activated nor a Dazed token. They block the Cleanup button.
export function cleanupBlockers(characters, poses) {
  return characters.filter(
    (ch) =>
      characterOnBoard(ch, poses) &&
      !((ch.tokens?.activated ?? 0) > 0 || (ch.tokens?.dazed ?? 0) > 0),
  )
}
