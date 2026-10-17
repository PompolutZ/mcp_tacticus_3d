// Dice symbol (dice/faces.js, SYMBOLS) -> face icon file in src/assets/tactic-icons/. The log draws the dice
// with these icons (docs/features/game-log.md). Plain module, no asset import: faceIcons.js makes the URL.

const DICE_ICONS = {
  crit: 'critical',
  wild: 'wild',
  hit: 'hit',
  block: 'block',
  skull: 'failure',
}

// The face icon file of a dice symbol, or null for blank (the log writes the word)
export const diceIconFile = (symbol) => DICE_ICONS[symbol] ?? null
