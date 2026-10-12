// The Priority marker of the game: who has Priority now. Plain module, no React. See
// docs/features/round-phases.md, "Priority marker".
//
// `game.priority` is the marker. It is a different field from `setup.priority` (the roll-off winner, which sets
// the colors for the whole game), because the marker moves in the Cleanup Phase and the colors must not.
// `game.lastActivated` is the side of the character that got the Activated token last.

import { isYou, playerName, verbFor } from '../setup/names.js'
import { otherTeam, priorityOf } from '../setup/setup.js'

// The side that has Priority, or null before the roll off. A document from before the marker has no
// `game.priority` (undefined, not null), and then the roll-off winner has it.
export function gamePriority(game, setup) {
  return game?.priority !== undefined ? game.priority : priorityOf(setup)
}

// Priority after the Cleanup Phase: it passes when the player who activated the last character has it (p12).
// No marker or no activation: it stays.
export function priorityAfterCleanup(priority, lastActivated) {
  return priority && lastActivated === priority ? otherTeam(priority) : priority
}

// The part of the Cleanup message about Priority, "" when nobody has it. ctx: the names context (setup/names.js).
export function priorityNote(before, after, ctx) {
  if (!after) return ''
  if (before !== after)
    return `Priority passes to ${isYou(after, ctx) ? 'you' : playerName(after, ctx)}.`
  return `${playerName(after, ctx)} ${verbFor(after, ctx, 'keep')} Priority.`
}

// The title of the marker, "Nelly has Priority. Click to give it to you."
export function priorityTitle(priority, ctx) {
  const other = otherTeam(priority)
  const to = isYou(other, ctx) ? 'you' : playerName(other, ctx)
  return `${playerName(priority, ctx)} ${verbFor(priority, ctx, 'have')} Priority. Click to give it to ${to}.`
}
