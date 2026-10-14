// The deck buttons ("Choose Secures", "Choose Extracts") of the deck step: the lock, the problem and the title.
// Shared by the buttons on the table (GameSetup.jsx) and the crisis compare overlay (CrisisCompare.jsx), so both
// lock and explain in the same way. No React.
import { chooserOf, otherTeam, otherType, viewOf } from './setup.js'
import { capital, possessive, says, their } from './names.js'

export const TYPE = { secure: 'Secure', extract: 'Extract' }

// In a multiplayer room, only the chooser of the current step clicks (chooserOf, setup/setup.js). Returns
// null when this browser may click, else the title for the disabled button: "Nelly chooses the Maximum
// Threat". The Sandbox and a single player room (no mySide) let anyone click.
export function lockedTitle(setup, what, ctx) {
  if (viewOf(setup)) return 'Browsing an earlier step'
  const chooser = chooserOf(setup)
  if (!ctx.mySide || !chooser || chooser === ctx.mySide) return null
  return `${says(chooser, ctx, 'choose')} ${what}`
}

// The reason why the deck of `type` of `team` cannot start the mission, or null
export function deckProblem(team, type, parsed, ctx) {
  const other = otherTeam(team)
  if (!parsed[other]) return `Load ${possessive(other, ctx)} roster first`
  if (parsed[team][type].length === 0)
    return `${capital(possessive(team, ctx))} roster has no ${TYPE[type]} cards`
  if (parsed[other][otherType(type)].length === 0)
    return `${capital(possessive(other, ctx))} roster has no ${TYPE[otherType(type)]} cards`
  return null
}

// The state of the deck button of `type` for `team`, the Priority player: { locked, disabled, title }. locked:
// the lock title or null (aria-disabled, no click). disabled: the deck has a problem (disabled button).
export function deckButton(setup, team, type, parsed, ctx) {
  const locked = lockedTitle(setup, 'a deck', ctx)
  const problem = deckProblem(team, type, parsed, ctx)
  return {
    locked,
    disabled: locked === null && problem !== null,
    title: locked ?? problem ?? `Play on ${their(team, ctx)} ${TYPE[type]} crises: draw 2 of them`,
  }
}

// The state of the Choose button of a drawn crisis card (first and second step): { locked, title }. Shared by
// the Choose chip on the table (GameSetup.jsx) and the Choose 1 overlay (CrisisChoose.jsx).
export function pickButton(setup, name, ctx) {
  const locked = lockedTitle(setup, 'a card', ctx)
  return { locked, title: locked ?? `Choose ${name}` }
}
