// The roll off, read from the dice trays. Plain module, no React and no imports. See
// docs/features/setup-game.md, "Roll off".

const SUCCESS = new Set(['crit', 'wild', 'hit'])

// The counts of one shelf. symbols: the symbols of its dice ('crit', 'wild', 'hit', 'block', 'blank', 'skull').
export function shelfCounts(symbols) {
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
