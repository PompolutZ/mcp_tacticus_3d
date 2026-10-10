// The roll history: the entries of the `rolls` list of the document, and their text. Plain module, no
// React. An entry stores data, not text, so a later change of the look needs no change of the data.
// See docs/feature-dice-rolling.md, "History".

import { SYMBOL_NAMES, SYMBOLS } from './faces.js'

// A list entity needs an id (net/collections.js). 8 hex characters are enough for one table.
function rollId() {
  return crypto.randomUUID().slice(0, 8)
}

// { <symbol>: n } of a list of symbols, with only the symbols above 0
export function countSymbols(symbols) {
  const counts = {}
  for (const symbol of symbols) counts[symbol] = (counts[symbol] ?? 0) + 1
  return counts
}

// The entry of a throw, or null when it has no dice. roll, crits: lists of symbols (new dice, and
// dice of "+N Crits"). reroll: [[from, to], …] of symbols.
export function throwEntry(side, at, { roll = [], crits = [], reroll = [] }) {
  if (roll.length + crits.length + reroll.length === 0) return null
  const entry = { id: rollId(), side, at, kind: 'throw' }
  if (roll.length) entry.roll = countSymbols(roll)
  if (crits.length) entry.crits = countSymbols(crits)
  if (reroll.length) entry.reroll = reroll.map(([from, to]) => [from, to])
  return entry
}

export function changeEntry(side, at, from, to) {
  return { id: rollId(), side, at, kind: 'change', from, to }
}

export function clearEntry(side, at) {
  return { id: rollId(), side, at, kind: 'clear' }
}

// "2 Hit, 1 Crit": most first, ties in shelf order, zeros left out
export function countsText(counts) {
  return SYMBOLS.map((symbol) => [symbol, counts[symbol] ?? 0])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([symbol, n]) => `${n} ${SYMBOL_NAMES[symbol]}`)
    .join(', ')
}

// "Blank → Hit, Skull → Crit"
function rerollText(pairs) {
  return pairs.map(([from, to]) => `${SYMBOL_NAMES[from]} → ${SYMBOL_NAMES[to]}`).join(', ')
}

// "Roll: 2 Hit, 1 Crit. Crits: 1 Wild. Reroll: Blank → Hit", "Changed: Skull → Block" or "Cleared"
export function entryText(entry) {
  if (entry.kind === 'clear') return 'Cleared'
  if (entry.kind === 'change') {
    return `Changed: ${SYMBOL_NAMES[entry.from]} → ${SYMBOL_NAMES[entry.to]}`
  }
  const parts = []
  if (entry.roll) parts.push(`Roll: ${countsText(entry.roll)}`)
  if (entry.crits) parts.push(`Crits: ${countsText(entry.crits)}`)
  if (entry.reroll?.length) parts.push(`Reroll: ${rerollText(entry.reroll)}`)
  return parts.join('. ')
}
