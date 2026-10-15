import { addEntry, logEntry } from '../log/log.js'
import { formatMctCode } from '../rosters/mct.js'
import {
  affiliationName,
  autoAffiliation,
  DEFAULT_AFFILIATION,
} from '../scoreboard/affiliations.js'
import { firstFreeSlot } from '../tactics/layout.js'
import { readRollOff, shelfSymbols } from './rollOff.js'
import {
  browse,
  chooseAffiliation,
  chooseDeck,
  chooseEdge,
  chooserOf,
  chooseThreat,
  CRISIS_TYPES,
  deployLockDue,
  lockWasSet,
  newSetup,
  otherTeam,
  otherType,
  overrideRemoval,
  overrideTo,
  pickCard,
  placedIds,
  placedSides,
  placeSquad,
  priorityOf,
  setPriority,
  setRollOff,
  setSquadCharacters,
  setupStep,
  squadProblem,
  toggleReady,
  toggleSquadCard,
} from './setup.js'

// The roll off, read from the shelves of the two dice trays, written to the setup, the Priority marker and the
// log. Both browsers run it when a throw arrives, so a roll off is read even when both players throw at the
// same time (docs/features/setup-game.md, "Roll off"). It writes only when the setup is not already in the
// result, and the log entry has a fixed id, so the writes of the two browsers end in the same document.
// throwId: the id of the last `throw` entry. Returns true when it wrote.
export function readRollOffWrite(table, { mySide, throwId }) {
  const current = table.setup.read()
  if (setupStep(current) !== 'rollOff') return false
  const shelves = shelfSymbols(table.dice.read())
  if (!shelves) return false
  const result = readRollOff(shelves)
  if (JSON.stringify(current.rollOff) === JSON.stringify(result)) return false
  // The marker follows the winner. On a tie it stays as it is.
  table.transact(() => {
    table.setup.set(setRollOff(current, result))
    if (result.winner) table.game.setField('priority', result.winner)
    const id = `rolloff:${current.id}:${throwId}`
    table.log.set((list) =>
      addEntry(list, logEntry('rollOff', mySide, { side: result.winner }, id)),
    )
  })
  return true
}

// Deploy Lock on, once, when both squads are placed (from this browser or the other one). Both browsers may
// write: `lockSet` is the marker that stops a second write, so a hand toggle of Deploy Lock after it stays.
// Returns true when it wrote.
export function deployLockWrite(table) {
  if (!deployLockDue(table.setup.read())) return false
  table.transact(() => {
    table.setup.set(lockWasSet)
    table.game.setField('deployLine', true)
  })
  return true
}

// The document writes of the game setup (docs/features/setup-game.md). Plain module, no React: it writes only
// the table, each action in one transaction, and reads the table, not render state. It does not ask the
// player and does not show messages: useGameSetup does, with what an action returns.
// context: { mySide, hiddenSquads } the seat, and the lookups and calls that do not load in Node:
// rosterCard(code), parseRosterText(text), affiliationChoices(parsed, places) of a squad,
// removeCharacter(id) (the character action of the table), crisis (the crisis actions, crisis/actions.js), and for
// the squads: squadThreat(parsed, places), squadAffiliationKeys(parsed, places), characterByCode(code),
// newCharacters(character, side, { attached }) and makeCardPiles(cards).
export function createSetupActions(table, context) {
  const writeLog = (kind, data, id) =>
    table.log.set((list) => addEntry(list, logEntry(kind, context.mySide, data, id)))
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
          if (key && current?.[type] === key) context.crisis.changeCrisis(type, null)
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

  // The squad of `side` is revealed and goes on the table: the characters get their trays and models, and
  // the Team Tactic cards go into the tactic tray. A character or a Team Tactic card that the player already
  // has on the table is not added again. One transaction: the squad, the cards and `placed`. The new
  // characters and cards are made before it, outside the state updaters, because the setup stores their ids
  // for a restart, and React can call an updater twice. When the squad has no affiliation to choose
  // (autoAffiliation), the same transaction sets it in the setup and in game.affiliations. The log entries
  // have fixed ids: an effect reveals, and a second run must not add a second entry.
  function revealSquad(side, squad) {
    const parsed = context.parseRosterText(table.rosters.read()[side]?.code ?? '')
    const newCharacters = []
    const newCards = []
    const onTable = table.characters.read()
    const cardsOnTable = table.tactics.read()
    for (const place of squad.characters) {
      const ch = context.characterByCode(parsed.characters[place]?.code)
      const there = [...onTable, ...newCharacters].some(
        (c) => c.key === ch?.slug && c.team === side,
      )
      if (ch?.available && !there)
        newCharacters.push(
          ...context.newCharacters(ch, side, { attached: parsed.characters[place].gems }),
        )
    }
    for (const place of squad.tactics) {
      const key = context.rosterCard(parsed.tactics[place])?.key
      const cards = [...cardsOnTable, ...newCards]
      if (!key || cards.some((card) => card.key === key && card.team === side)) continue
      const slot = firstFreeSlot(side, cards)
      newCards.push({ id: crypto.randomUUID(), key, team: side, x: slot.x, z: slot.z, up: 'face' })
    }
    const newPiles = context.makeCardPiles(newCards)
    const auto = autoAffiliation(context.squadAffiliationKeys(parsed, squad.characters))
    table.transact(() => {
      table.characters.set((prev) => [...prev, ...newCharacters])
      table.tactics.set((prev) => [...prev, ...newCards])
      table.tokenPiles.set((prev) => [...prev, ...newPiles])
      table.setup.set((prev) =>
        placeSquad(
          prev,
          side,
          squad,
          {
            characters: newCharacters.map((ch) => ch.id),
            tactics: newCards.map((card) => card.id),
          },
          auto,
        ),
      )
      if (auto) table.game.setField('affiliations', (prev) => ({ ...prev, [side]: auto }))
      const setupId = table.setup.read().id
      writeLog('revealed', { side }, `revealed:${setupId}:${side}`)
      if (auto)
        writeLog(
          'affiliation',
          { side, affiliation: affiliationName(auto) },
          `affiliation:${setupId}:${side}`,
        )
    })
  }

  return {
    revealSquad,
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

    // Adds the card at `index` of the roster tab ('characters' or 'tactics') of `team` to the squad in the
    // document, or removes it (the Sandbox and single player rooms; in a multiplayer room the squad is stored
    // in the browser until the reveal)
    toggleSquad: (team, tab, index) =>
      table.setup.set((prev) => toggleSquadCard(prev, team, tab, index)),

    // The squad of `team` gets these character places (a click on a squad of the Breakdown tab); the Team
    // Tactic cards stay
    chooseBreakdown: (team, places) =>
      table.setup.set((prev) => setSquadCharacters(prev, team, places)),

    // The Ready toggle of `team`. Ready works when the squad has a character and its threat is not above the
    // Maximum Threat. While the player is Ready, their squad does not change. squad: the squad of a player
    // whose squad is stored in the browser (multiplayer), otherwise the one in the setup. It writes only the
    // toggle: when both players are Ready, the reveal effect puts the squads on the table. Returns true
    // when it wrote.
    ready(team, squad) {
      const setup = table.setup.read()
      if (setupStep(setup) !== 'squads' || (context.hiddenSquads && team !== context.mySide))
        return false
      // A placed squad is on the table for good
      if (placedSides(setup)[team]) return false
      if (!setup.ready[team]) {
        const own = squad ?? setup.squads[team]
        const problem = squadProblem({
          threat: context.squadThreat(parsedOf(team), own.characters),
          count: own.characters.length,
          maxThreat: setup.threat,
        })
        if (problem) return false
      }
      table.transact(() => {
        table.setup.set(toggleReady(setup, team))
        writeLog('ready', { side: team, ready: !setup.ready[team] })
      })
      return true
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
          context.crisis.changeCrisis(type, info?.key ?? null)
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
