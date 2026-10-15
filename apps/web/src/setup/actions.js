import { addEntry, logEntry } from '../log/log.js'
import { formatMctCode } from '../rosters/mct.js'
import { affiliationName, DEFAULT_AFFILIATION } from '../scoreboard/affiliations.js'
import {
  browse,
  chooseAffiliation,
  chooseDeck,
  chooseEdge,
  chooserOf,
  chooseThreat,
  CRISIS_TYPES,
  newSetup,
  otherTeam,
  otherType,
  overrideRemoval,
  overrideTo,
  pickCard,
  placedIds,
  priorityOf,
  setPriority,
  setupStep,
} from './setup.js'

// The document writes of the game setup (docs/features/setup-game.md). Plain module, no React: it writes only
// the table, each action in one transaction, and reads the table, not render state. It does not ask the
// player and does not show messages: useGameSetup does, with what an action returns.
// context: { mySide, hiddenSquads } the seat, and the lookups and calls that do not load in Node:
// rosterCard(code), parseRosterText(text), affiliationChoices(parsed, places) of a squad,
// removeCharacter(id) and changeCrisis(type, key) (the character and crisis actions of the table).
export function createSetupActions(table, context) {
  const writeLog = (kind, data) =>
    table.log.set((list) => addEntry(list, logEntry(kind, context.mySide, data)))
  const parsedOf = (team) => {
    const roster = table.rosters.read()[team]
    return roster ? context.parseRosterText(roster.code) : null
  }

  // The marker and the last activation go with the roll off
  function clearPriorityMarker() {
    table.game.setField('priority', null)
    table.game.setField('lastActivated', null)
  }

  // Takes what the setup put on the table off it: squads (the characters and Team Tactic cards of the
  // activated squads) and crisis (the two crisis cards of the mission with their tokens). A crisis card that
  // a player changed in the toolbar since then stays. Restart and Override use it.
  function removeSetupPieces({ squads, crisis }) {
    const setup = table.setup.read()
    table.transact(() => {
      if (squads) {
        const placed = placedIds(setup)
        placed.characters.forEach(context.removeCharacter)
        table.tactics.set((prev) => prev.filter((card) => !placed.tactics.includes(card.id)))
        table.tokenPiles.set((prev) => prev.filter((p) => !placed.tactics.includes(p.card)))
      }
      if (crisis && setup.edge) {
        const current = table.game.get('crisis')
        for (const type of CRISIS_TYPES) {
          const key = context.rosterCard(setup.picks[type])?.key
          if (key && current?.[type] === key) context.changeCrisis(type, null)
        }
      }
    })
  }

  // Starts the game setup again. It removes what the setup put on the table: the characters and Team
  // Tactic cards of the activated squads, and the crisis cards of the mission with their tokens. A crisis
  // card that a player changed in the toolbar since then stays. So does the mat turn. Returns true when
  // the setup had started.
  function restart() {
    if (setupStep(table.setup.read()) === 'deck') return false
    table.transact(() => {
      removeSetupPieces({ squads: true, crisis: true })
      table.game.setField('deployLine', false)
      table.setup.set(newSetup())
      clearPriorityMarker()
      writeLog('restart', {})
    })
    return true
  }

  // Sets the roster of `team` to `parsed` (null removes it) and starts the setup again. Returns
  // { restarted, unknown }: unknown are the codes of the text that the app does not know.
  function setRoster(team, parsed) {
    const restarted = table.transact(() => {
      table.rosters.set((prev) => ({
        ...prev,
        [team]: parsed ? { code: formatMctCode(parsed) } : null,
      }))
      return restart()
    })
    return { restarted, unknown: parsed?.unknown ?? [] }
  }

  return {
    clearPriorityMarker,
    removeSetupPieces,
    restart,
    loadRoster: setRoster,
    removeRoster: (team) => setRoster(team, null),

    // Prev / Next of the panel: the step that both players browse, or null for the current step
    browse: (step) => table.setup.set((prev) => browse(prev, step)),

    // `step` becomes the current step for both players and the later choices are dropped (overrideTo). What the
    // setup put on the table after that step leaves it the same way as for restart. Deploy Lock goes off with
    // the squads.
    override(step) {
      const setup = table.setup.read()
      const removal = overrideRemoval(setup, step)
      table.transact(() => {
        removeSetupPieces(removal)
        if (removal.squads) table.game.setField('deployLine', false)
        table.setup.set(overrideTo(setup, step))
        if (step === 'rollOff') clearPriorityMarker()
        writeLog('override', { step })
      })
    },

    // The roll off is over: `team` has Priority
    priority(team) {
      const setup = table.setup.read()
      if (setupStep(setup) !== 'rollOff') return
      table.transact(() => {
        table.setup.set(setPriority(setup, team))
        table.game.setField('priority', team)
        writeLog('rollOff', { side: team, manual: true })
      })
    },

    // The player with Priority uses their deck of `type`. The draws are random, so they are made here, outside
    // a state updater, which React can call twice.
    deck(type) {
      const setup = table.setup.read()
      const team = priorityOf(setup)
      const parsed = setupStep(setup) === 'deck' && parsedOf(team)
      if (!parsed) return
      table.transact(() => {
        table.setup.set(chooseDeck(setup, type, parsed[type]))
        writeLog('deck', { side: team, type })
      })
    },

    // A Use button on a drawn crisis card. After the first card, 2 cards are drawn from the other deck of the
    // other player.
    pick(code) {
      const setup = table.setup.read()
      const step = setupStep(setup)
      if (step !== 'first' && step !== 'second') return
      const other = parsedOf(otherTeam(priorityOf(setup)))
      const type = step === 'first' ? setup.deck.type : otherType(setup.deck.type)
      table.transact(() => {
        table.setup.set(pickCard(setup, code, other?.[otherType(setup.deck.type)] ?? []))
        writeLog('pick', {
          side: chooserOf(setup),
          type,
          card: context.rosterCard(code)?.name ?? code,
        })
      })
    },

    threat(threat) {
      const setup = table.setup.read()
      if (setupStep(setup) !== 'threat') return
      table.transact(() => {
        table.setup.set(chooseThreat(setup, threat))
        writeLog('threat', { side: chooserOf(setup), threat })
      })
    },

    // Choose this edge: the mat stays as it is now. The two crisis cards of the mission go to the ends of the
    // scoring board, and their tokens to the mat. Returns { missing }: the names of the cards that have no
    // files in the app, so no tokens.
    edge() {
      const setup = table.setup.read()
      const missing = []
      if (setupStep(setup) !== 'edge') return { missing }
      table.transact(() => {
        for (const type of CRISIS_TYPES) {
          const info = context.rosterCard(setup.picks[type])
          if (!info?.key) missing.push(info?.name ?? setup.picks[type])
          context.changeCrisis(type, info?.key ?? null)
        }
        table.setup.set(chooseEdge(setup))
        writeLog('edge', { side: chooserOf(setup) })
      })
      return { missing }
    },

    // The player of `side` chooses the affiliation of the squad at the step affiliation: the setup and the VP
    // marker, in one transaction. In a multiplayer room, only the own side.
    affiliation(side, key) {
      const setup = table.setup.read()
      if (setupStep(setup) !== 'affiliation') return
      if (context.hiddenSquads && side !== context.mySide) return
      const choices = context.affiliationChoices(parsedOf(side), setup.squads[side].characters)
      if (key !== DEFAULT_AFFILIATION && !choices.includes(key)) return
      table.transact(() => {
        table.setup.set(chooseAffiliation(setup, side, key))
        table.game.setField('affiliations', (prev) => ({ ...prev, [side]: key }))
        writeLog('affiliation', { side, affiliation: affiliationName(key) })
      })
    },
  }
}
