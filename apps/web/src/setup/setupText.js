// The texts of the game setup: the names of the steps, the choice of a done step, the hint of a step
// (docs/features/setup-game.md). No component or card lookup imports, so a Node test can run it.
import { affiliationName, DEFAULT_AFFILIATION } from '../scoreboard/affiliations.js'
import { CRISIS_TYPES, TEAMS, otherTeam, otherType, priorityOf } from './setup.js'
import { chose, isYou, playerName, says, their } from './names.js'
import { TYPE } from './deckButton.js'

// The names of the done steps (Prev / Next, Override)
export const STEP_NAME = {
  rollOff: 'Roll off',
  deck: 'Deck',
  first: 'First card',
  second: 'Second card',
  threat: 'Maximum Threat',
  edge: 'Deployment edge',
  squads: 'Squads',
  affiliation: 'Affiliation',
  deploy: 'Deployment',
}

// The choice of a done step in words: "Nelly chose Extract · 18"
export function stepChoice(setup, step, ctx, cardOf) {
  const winner = priorityOf(setup)
  const other = winner && otherTeam(winner)
  const first = setup.deck?.type
  const second = first && otherType(first)
  const card = (code) => cardOf(code)?.name ?? code
  switch (step) {
    case 'rollOff':
      return `${says(winner, ctx, 'have')} Priority`
    case 'deck':
      return `${says(winner, ctx, 'play')} on ${their(winner, ctx)} ${TYPE[first]} crises.`
    case 'first':
      return `${chose(other, ctx)} ${card(setup.picks[first])}`
    case 'second':
      return `${chose(winner, ctx)} ${card(setup.picks[second])}`
    case 'threat': {
      const type = CRISIS_TYPES.find((t) => cardOf(setup.picks[t])?.threat === setup.threat)
      return `${chose(other, ctx)} ${type ? `${TYPE[type]} · ` : ''}${setup.threat}`
    }
    case 'edge':
      return `${chose(winner, ctx)} the board edge`
    case 'squads':
      return 'Both squads are Ready'
    case 'affiliation':
      return TEAMS.map(
        (team) =>
          `${playerName(team, ctx)}: ${affiliationName(setup.affiliation?.[team] ?? DEFAULT_AFFILIATION)}`,
      ).join(' · ')
    default:
      return 'Both squads deployed'
  }
}

// What `team` does in a step that one player chooses. The own side in a multiplayer room gets "You choose the
// board edge", the other player "Waiting for Nelly to choose the board edge." What: "a deck", "the Maximum
// Threat". With imperative, the own side gets "Choose …" ("Choose from Nelly's Secures.").
export function chooses(team, what, ctx, imperative = false) {
  if (ctx.mySide && !isYou(team, ctx))
    return `Waiting for ${playerName(team, ctx)} to choose ${what}.`
  return imperative && isYou(team, ctx)
    ? `Choose ${what}.`
    : `${says(team, ctx, 'choose')} ${what}.`
}

// The deck step text for `team`, the Priority player: "Decide if you want to play on your Secure or Extract
// crises.", "Waiting for Nelly to decide if they want to ...", "Blue decides if they want to ..."
export function decides(team, ctx) {
  const rest = `if ${isYou(team, ctx) ? 'you' : 'they'} want to play on ${their(team, ctx)} Secure or Extract crises.`
  if (ctx.mySide && !isYou(team, ctx))
    return `Waiting for ${playerName(team, ctx)} to decide ${rest}`
  return isYou(team, ctx) ? `Decide ${rest}` : `${says(team, ctx, 'decide')} ${rest}`
}

// The text of a roll off that the app read: "Nelly wins the roll off: 4 successes against 3." On equal
// successes the Crits or the Wilds decided. result: { winner, counts } (rollOff.js).
export function rollOffText({ winner, counts }, ctx) {
  if (!winner) return 'Tie: roll again.'
  const a = counts[winner]
  const b = counts[otherTeam(winner)]
  const base = `${says(winner, ctx, 'win')} the roll off: ${a.successes} successes against ${b.successes}`
  if (a.successes !== b.successes) return `${base}.`
  if (a.crits !== b.crits) return `${base}, with more Crits (${a.crits} against ${b.crits}).`
  return `${base}, with more Wilds (${a.wilds} against ${b.wilds}).`
}
