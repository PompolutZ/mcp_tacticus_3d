// The roll off, read from the dice trays. Plain module, no React; its only import is dice/faces.js, which
// loads in Node. See docs/features/setup-game.md, "Roll off".

import { FACES } from '../dice/faces.js'
import { TEAMS } from './setup.js'

// Dice that each player rolls in the roll off
const ROLL_OFF_DICE = 5
// A throw entry older than this (ms) is not a new throw
export const ROLL_OFF_FRESH = 30000

const SUCCESS = new Set(['crit', 'wild', 'hit'])

// The counts of one shelf. symbols: the symbols of its dice ('crit', 'wild', 'hit', 'block', 'blank', 'skull').
function shelfCounts(symbols) {
  const counts = { successes: 0, crits: 0, wilds: 0 }
  for (const symbol of symbols) {
    if (SUCCESS.has(symbol)) counts.successes++
    if (symbol === 'crit') counts.crits++
    if (symbol === 'wild') counts.wilds++
  }
  return counts
}

// shelves: { host: [symbol, …], guest: [symbol, …] }. The winner has more successes (Crit, Wild and Hit),
// then more Crits, then more Wilds. winner: 'host' | 'guest' | null on a tie.
export function readRollOff(shelves) {
  const counts = { host: shelfCounts(shelves.host), guest: shelfCounts(shelves.guest) }
  let winner = null
  for (const key of ['successes', 'crits', 'wilds']) {
    if (counts.host[key] !== counts.guest[key]) {
      winner = counts.host[key] > counts.guest[key] ? 'host' : 'guest'
      break
    }
  }
  return { winner, counts }
}

// Is there a new `throw` entry in rolls? seen: the Set of entry ids read before. now: Date.now(). An entry
// older than ROLL_OFF_FRESH ms is not new.
export function hasFreshThrow(rolls, seen, now) {
  return rolls.some(
    (entry) => entry.kind === 'throw' && !seen.has(entry.id) && now - entry.at < ROLL_OFF_FRESH,
  )
}

// The symbols of the dice on the shelves, { host: [symbol, …], guest: [symbol, …] }, for readRollOff, or
// null unless both shelves hold ROLL_OFF_DICE dice. dice: the dice document, { [team]: { dice: { [id]:
// { place, face } } } }.
export function shelfSymbols(dice) {
  const shelves = {}
  for (const team of TEAMS) {
    const onShelf = Object.values(dice[team]?.dice ?? {}).filter((die) => die.place === 'shelf')
    if (onShelf.length !== ROLL_OFF_DICE) return null
    shelves[team] = onShelf.map((die) => FACES[die.face - 1]?.symbol)
  }
  return shelves
}
