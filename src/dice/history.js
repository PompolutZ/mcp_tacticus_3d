// Text for the history of a dice tray (design, "History"). Plain module, no React and no
// src/assets/index.js import, so scripts/dice-sim.mjs can use it in Node.
//
// The functions here only build strings from counts and symbol pairs the caller already has.
// DiceTray.jsx decides when to call them and gives each entry an id.

import { SYMBOL_NAMES, SYMBOLS } from './faces.js'

function hasAny(counts) {
  return SYMBOLS.some(symbol => (counts[symbol] ?? 0) > 0)
}

// "2 Hit, 1 Crit, 1 Blank, 1 Skull": most first, ties broken by shelf order, zeros left out.
// counts: { [symbol]: number }
export function countsText(counts) {
  return SYMBOLS
    .map(symbol => [symbol, counts[symbol] ?? 0])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([symbol, n]) => `${n} ${SYMBOL_NAMES[symbol]}`)
    .join(', ')
}

// "Blank → Hit, Skull → Crit". pairs: [{ from, to }] (symbol keys)
function rerollText(pairs) {
  return pairs.map(({ from, to }) => `${SYMBOL_NAMES[from]} → ${SYMBOL_NAMES[to]}`).join(', ')
}

// One history entry for a throw. Each of `roll`, `crits` (counts of the dice that came from that
// source in this throw) and `reroll` (a list of { from, to }) is optional; the entry has one part
// per source that is not empty, in this order. `shelfAfter` is the shelf counts once this throw's
// results are added; it is only shown when `shelfBefore` (the shelf counts before the throw) had
// any dice, because otherwise the shelf and the throw are the same dice.
// Examples (design, "History"):
//   throwEntryText({ roll: { hit: 2, crit: 1, blank: 1, skull: 1 } })
//     -> "Roll: 2 Hit, 1 Crit, 1 Blank, 1 Skull"
//   throwEntryText({ crits: { wild: 1 }, shelfBefore: {...}, shelfAfter: {...} })
//     -> "Crits: 1 Wild. Shelf: 2 Hit, 1 Crit, 1 Wild, 1 Blank, 1 Skull"
//   throwEntryText({ reroll: [{ from: 'blank', to: 'hit' }], shelfBefore: {...}, shelfAfter: {...} })
//     -> "Reroll: Blank → Hit. Shelf: 3 Hit, 1 Crit, 1 Wild, 1 Skull"
export function throwEntryText({ roll, crits, reroll, shelfBefore, shelfAfter }) {
  const parts = []
  if (roll && hasAny(roll)) parts.push(`Roll: ${countsText(roll)}`)
  if (crits && hasAny(crits)) parts.push(`Crits: ${countsText(crits)}`)
  if (reroll && reroll.length) parts.push(`Reroll: ${rerollText(reroll)}`)
  if (shelfBefore && hasAny(shelfBefore)) parts.push(`Shelf: ${countsText(shelfAfter)}`)
  return parts.join('. ')
}

// "Changed: Skull → Block"
export function changeText(from, to) {
  return `Changed: ${SYMBOL_NAMES[from]} → ${SYMBOL_NAMES[to]}`
}

// "Cleared"
export const CLEARED_TEXT = 'Cleared'
