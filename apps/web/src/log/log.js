// The game log: the entries of the `log` list of the document, and their text. Plain module, no React.
// The dice have their own list, `rolls` (dice/history.js). The panel merges both (mergeLog). An entry stores
// data, not text, so "You" is right in each browser. See docs/features/game-log.md.

import { isYou, playerName, says } from '../setup/names.js'
import { priorityNote } from '../game/priority.js'

// The log keeps the newest entries only. A write that goes over removes the oldest ones.
export const LOG_LIMIT = 300

// An entry: { id, at, by, kind, ...data }. by: the side of the browser that wrote it, null in the Sandbox and
// a single player room. Sides in the data (`side`) say whose action it was. id: random, or a fixed one when
// both browsers write the same event (the same id makes one entry).
export function logEntry(
  kind,
  by,
  data = {},
  id = crypto.randomUUID().slice(0, 8),
  at = Date.now(),
) {
  return { id, at, by: by ?? null, kind, ...data }
}

// The list with `entry` at the end and at most LOG_LIMIT entries (the oldest go). An entry with an id that is
// already there is not added again. Use it as table.log.set((list) => addEntry(list, entry)).
export function addEntry(list, entry) {
  if (list.some((e) => e.id === entry.id)) return list
  return [...list, entry].slice(-LOG_LIMIT)
}

// The entries of both lists in one list, newest first. rolls, log: oldest first, as stored. On the same
// millisecond the log entry is newer: the roll-off result is written after the throw.
export function mergeLog(rolls, log) {
  const all = [
    ...rolls.map((entry) => ({ type: 'dice', entry })),
    ...log.map((entry) => ({ type: 'log', entry })),
  ]
  return all
    .map((item, i) => [item, i])
    .sort((a, b) => b[0].entry.at - a[0].entry.at || b[1] - a[1])
    .map(([item]) => item)
}

// The side of an entry for its color, or null. Dice entries have `side`, log entries `side` or `by`.
export const entrySide = (entry) => entry.side ?? entry.by ?? null

// What a player sees in the setup panel, for the steps of the setup
const STEP_NAMES = {
  rollOff: 'the roll off',
  deck: 'the deck',
  first: 'the first card',
  second: 'the second card',
  threat: 'the Maximum Threat',
  edge: 'the board edge',
  squads: 'the squads',
  affiliation: 'the affiliation',
  deploy: 'the deployment',
}

const DECK_NAMES = { secure: 'Secure', extract: 'Extract' }

// "you" for the own side, else the name: for the end of a sentence
const to = (side, ctx) => (isYou(side, ctx) ? 'you' : playerName(side, ctx))

// "Nelly's" or "Your": the start of a sentence
const owner = (side, ctx) => (isYou(side, ctx) ? 'Your' : `${playerName(side, ctx)}'s`)

// "Hulk 4 → 7, Angela 2 → 4"
const gainsText = (gains) => gains.map((g) => `${g.name} ${g.from} → ${g.to}`).join(', ')

// The text of a log entry for the viewer. ctx: the names context (setup/names.js).
export function logText(entry, ctx) {
  const { kind, side } = entry
  switch (kind) {
    case 'rollOff':
      return side
        ? `Roll off: ${says(side, ctx, 'have')} Priority${entry.manual ? ' (set by hand)' : ''}.`
        : 'Roll off: a tie.'
    case 'deck':
      return `${says(side, ctx, 'choose')} the ${DECK_NAMES[entry.type]} deck.`
    case 'pick':
      return `${says(side, ctx, 'choose')} ${entry.card} (${DECK_NAMES[entry.type]}).`
    case 'threat':
      return `${says(side, ctx, 'choose')} Maximum Threat ${entry.threat}.`
    case 'edge':
      return `${says(side, ctx, 'choose')} this board edge.`
    case 'ready':
      return `${playerName(side, ctx)} ${entry.ready ? 'is' : 'is not'} ready.`
    case 'revealed':
      return `${owner(side, ctx)} squad is on the table.`
    case 'affiliation':
      return `${says(side, ctx, 'choose')} the affiliation ${entry.affiliation}.`
    case 'deployed':
      return 'Deployment done.'
    case 'override':
      return `${entry.by ? `${playerName(entry.by, ctx)} went` : 'Went'} back to ${STEP_NAMES[entry.step]}.`
    case 'restart':
      return `${entry.by ? `${playerName(entry.by, ctx)} started` : 'Started'} the setup again.`
    case 'power':
      return `Power Phase (${playerName(side, ctx)}): ${gainsText(entry.gains)}`
    case 'cleanup': {
      const head =
        entry.round === null
          ? 'Cleanup Phase: the round marker did not move.'
          : `Cleanup Phase: round ${entry.round}.`
      const flipped = entry.flipped.length > 0 ? ` Flipped: ${entry.flipped.join(', ')}.` : ''
      const note = priorityNote(entry.before, entry.after, ctx)
      return `${head}${flipped}${note ? ` ${note}` : ''}`
    }
    case 'priority':
      return `Priority goes to ${to(side, ctx)}.`
    default:
      return ''
  }
}
