// The game log: the entries of the `log` list of the document, and their text. Plain module, no React.
// The dice have their own list, `rolls` (dice/history.js). The panel merges both (mergeLog). An entry stores
// data, not text, so "You" is right in each browser. See docs/features/game-log.md.

import { isYou, playerName, says, their } from '../setup/names.js'
import { priorityNote } from '../game/priority.js'
import { TERRAIN_PIECES } from '../terrain/pieces.js'

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

// Damage and Power clicks on one character, by one player, within this time change the last entry
// (addStatEntry).
export const MERGE_MS = 10_000

// The list with a Damage or Power entry { kind: 'stat', characterId, stat, from, to }. When the last entry of
// the list is the same character and stat, by the same writer, and at most MERGE_MS older, it changes
// instead ("Damage 2 → 5") and takes the new time, so a run of clicks stays one entry. A value back at the
// start of that entry removes it. A change that does nothing (from equals to) adds nothing.
export function addStatEntry(list, entry) {
  const last = list[list.length - 1]
  const same =
    last?.kind === 'stat' &&
    last.by === entry.by &&
    last.characterId === entry.characterId &&
    last.stat === entry.stat &&
    entry.at - last.at <= MERGE_MS
  if (same) {
    if (last.from === entry.to) return list.slice(0, -1)
    return [...list.slice(0, -1), { ...last, to: entry.to, at: entry.at }]
  }
  if (entry.from === entry.to) return list
  return addEntry(list, entry)
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

// The sound group of an entry (sound.js), or null. Only a token put on a character sounds. Activated has its own
// sound. A held objective token sounds like a token.
export function soundOf(entry) {
  if (!entry.on) return null
  if (entry.kind === 'token') return entry.key === 'activated' ? 'activated' : 'token'
  if (entry.kind === 'held') return 'token'
  return null
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

const STAT_NAMES = { damage: 'Damage', power: 'Power' }

const DECK_NAMES = { secure: 'Secure', extract: 'Extract' }

// "you" for the own side, else the name: for the end of a sentence
const to = (side, ctx) => (isYou(side, ctx) ? 'you' : playerName(side, ctx))

// "Nelly's" or "Your": the start of a sentence
const owner = (side, ctx) => (isYou(side, ctx) ? 'Your' : `${playerName(side, ctx)}'s`)

// "Hulk 4 → 7, Angela 2 → 4"
const gainsText = (gains) => gains.map((g) => `${g.name} ${g.from} → ${g.to}`).join(', ')

// True when the Undo button shows on a log entry: a terrain delete whose piece is not on the table, on the
// same map. After an undo, or a map change, it is gone. terrain: the terrain of the table (ids), mapId: now.
export function canUndo(entry, terrain, mapId) {
  return (
    entry.kind === 'terrainDeleted' &&
    entry.mapId === mapId &&
    !terrain.some((p) => p.id === entry.piece.id)
  )
}

// "Deleted Crate." with the name of the writer in front, "You" for the own side
const pieceAction = (entry, ctx, verb) =>
  `${entry.by ? `${playerName(entry.by, ctx)} ${verb}` : `${verb[0].toUpperCase()}${verb.slice(1)}`} ${TERRAIN_PIECES[entry.pieceKey]?.name ?? 'a terrain piece'}.`

// The text of a log entry for the viewer. ctx: the names context (setup/names.js).
export function logText(entry, ctx) {
  const { kind, side } = entry
  switch (kind) {
    case 'rollOff':
      return side
        ? `Roll off: ${says(side, ctx, 'have')} Priority${entry.manual ? ' (set by hand)' : ''}.`
        : 'Roll off: a tie.'
    case 'deck':
      return `${says(side, ctx, 'play')} on ${their(side, ctx)} ${DECK_NAMES[entry.type]} crises.`
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
    case 'stat':
      return `${entry.name} ${STAT_NAMES[entry.stat]} ${entry.from} → ${entry.to}`
    case 'flip':
      return `${entry.name} turns to the ${entry.to} side.`
    case 'token': {
      // The count shows for a token that counts up
      const count = entry.on && entry.count > 1 ? ` (${entry.count})` : ''
      return entry.on
        ? `${entry.tokenName} put on ${entry.name}${count}.`
        : `${entry.tokenName} taken off ${entry.name}.`
    }
    case 'held':
      return entry.on
        ? `${entry.name} holds ${entry.tokenName}.`
        : `${entry.name} drops ${entry.tokenName} from the card.`
    case 'dropped':
      return `${entry.name} dropped ${entry.tokenName}. ${says(entry.placeBy, ctx, 'place')} it.`
    case 'placed':
      return `${playerName(entry.placeBy, ctx)} placed ${entry.name}'s ${entry.tokenName}.`
    case 'offBoard':
      return `${entry.name} is removed from the board.`
    case 'deleted':
      return `${entry.name} is deleted from the table.`
    case 'terrainDeleted':
      return pieceAction(entry, ctx, 'deleted')
    case 'terrainRestored':
      return pieceAction(entry, ctx, 'put back')
    default:
      return ''
  }
}
