import { useEffect, useMemo, useState } from 'react'
import {
  affiliationName,
  autoAffiliation,
  DEFAULT_AFFILIATION,
} from '../scoreboard/affiliations.js'
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
  ownSquadOf,
  pickCard,
  placedIds,
  placedSides,
  placeSquad,
  priorityOf,
  revealPlan,
  setPriority,
  setSquadCharacters,
  setupPlacedCards,
  setupStep,
  squadChoiceBlock,
  squadProblem,
  TEAMS,
  toggleReady,
  toggleSquadCard,
  viewerSetup,
} from './setup.js'
import { characterByCode } from '../characters/characters.js'
import { deleteSquad, readSquad, saveSquad } from '../rooms/store.js'
import { firstFreeSlot } from '../tactics/layout.js'
import { formatMctCode, isEmptyRoster } from '../rosters/mct.js'
import { newCharacters as makeCharacters } from '../characters/newCharacter.js'
import {
  parseRosterText,
  rosterCard,
  squadAffiliationChoices,
  squadAffiliationKeys,
  squadThreat,
  unknownCodesMessage,
} from '../rosters/cards.js'

// What a restart of the game setup removes, for its confirm (restartSetup)
const SETUP_REMOVAL =
  'The squads and the crisis cards that the game setup put on the table are removed.'

// The game setup: rosters, the setup steps, squads and the reveal (see docs/features/setup-game.md). It is
// called after useRollOffReader: effect E8 must run before the reveal effect E9 below.
export function useGameSetup({
  crisis,
  handleCharacterRemove,
  handleCrisisChange,
  handleTurnMat,
  hiddenSquads,
  makeCardPiles,
  mySide,
  removeCardPiles,
  room,
  rosters,
  setAffiliations,
  setCharacters,
  setDeployLine,
  setOpenRoster,
  setPriorityField,
  setRosters,
  setSetup,
  setTacticCards,
  setTokenPiles,
  setup,
  showHudMessage,
  table,
  userId,
  writeLog,
}) {
  const [storedSquad, setStoredSquad] = useState(() =>
    hiddenSquads ? readSquad(userId, room.id) : null,
  )
  // The squad of the own side, and the setup as this player sees it: the other player's squad is empty
  // until it is placed. After the reveal it is in the document, and the affiliation step needs it.
  const ownSquad = ownSquadOf(storedSquad, setup, mySide)
  const viewSetup = useMemo(
    () => viewerSetup(setup, { hidden: hiddenSquads, mySide, ownSquad }),
    [hiddenSquads, setup, mySide, ownSquad],
  )

  // Loads the roster text of one team. A text with no known code keeps the old roster. Unknown
  // codes are named in the HUD, the known ones load. The game setup starts again, because it points to
  // the cards of the rosters. When the setup put cards or a squad on the table, a confirm asks first,
  // because the restart removes them.
  function handleRosterLoad(team, text) {
    const parsed = parseRosterText(text)
    if (isEmptyRoster(parsed)) {
      showHudMessage('No known MCT code in the text')
      return
    }
    if (!confirmSetupRemoval('Load this roster')) return
    const restarted = table.transact(() => {
      setRosters((prev) => ({ ...prev, [team]: { code: formatMctCode(parsed) } }))
      return restartSetup()
    })
    // The open card may not be in the new roster
    setOpenRoster((prev) => (prev?.team === team ? null : prev))
    if (parsed.unknown.length > 0) showHudMessage(unknownCodesMessage(parsed.unknown))
    else if (restarted) showHudMessage('Game setup started again')
  }

  function handleRosterRemove(team) {
    if (!confirmSetupRemoval('Remove this roster')) return
    const restarted = table.transact(() => {
      setRosters((prev) => ({ ...prev, [team]: null }))
      return restartSetup()
    })
    setOpenRoster((prev) => (prev?.team === team ? null : prev))
    if (restarted) showHudMessage('Game setup started again')
  }

  // The rosters as parsed by rosters/mct.js: { host, guest } → parsed roster or null
  const parsedRosters = useMemo(
    () => ({
      host: rosters.host && parseRosterText(rosters.host.code),
      guest: rosters.guest && parseRosterText(rosters.guest.code),
    }),
    [rosters],
  )

  // True when nothing that the setup put on the table would be removed, or the player confirms. action:
  // the start of the question, for example 'Load this roster'.
  function confirmSetupRemoval(action) {
    return (
      !setupPlacedCards(setup) ||
      window.confirm(`${action} and start the game setup again? ${SETUP_REMOVAL}`)
    )
  }

  // Starts the game setup again. It removes what the setup put on the table: the characters and Team
  // Tactic cards of the activated squads, and the crisis cards of the mission with their tokens. A crisis
  // card that a player changed in the toolbar since then stays. So does the mat turn. Returns true when
  // the setup had started.
  function restartSetup() {
    if (hiddenSquads) {
      deleteSquad(userId, room.id)
      setStoredSquad(null)
    }
    if (setupStep(setup) === 'deck') return false
    table.transact(() => {
      removeSetupPieces({ squads: true, crisis: true })
      setDeployLine(false)
      setSetup(newSetup())
      clearPriorityMarker()
      writeLog('restart', {})
    })
    return true
  }

  // The marker and the last activation go with the roll off
  function clearPriorityMarker() {
    table.game.setField('priority', null)
    table.game.setField('lastActivated', null)
  }

  // Takes what the setup put on the table off it: squads (the characters and Team Tactic cards of the
  // activated squads) and crisis (the two crisis cards of the mission with their tokens). A crisis card that
  // a player changed in the toolbar since then stays. Restart setup and Override use it.
  function removeSetupPieces({ squads, crisis: crisisCards }) {
    if (squads) {
      const placed = placedIds(setup)
      placed.characters.forEach(handleCharacterRemove)
      setTacticCards((prev) => prev.filter((card) => !placed.tactics.includes(card.id)))
      removeCardPiles(placed.tactics)
    }
    if (crisisCards && setup.edge) {
      for (const type of CRISIS_TYPES) {
        const key = rosterCard(setup.picks[type])?.key
        if (key && crisis[type] === key) handleCrisisChange(type, null)
      }
    }
  }

  // The Restart setup button (GameSetup.jsx)
  function handleSetupRestart() {
    if (window.confirm(`Start the game setup again? ${SETUP_REMOVAL}`)) restartSetup()
  }

  // Prev / Next of the panel: the step that both players browse, or null for the current step
  function handleSetupBrowse(step) {
    setSetup((prev) => browse(prev, step))
  }

  // The Override button of a browsed step, after a confirm. `step` becomes the current step for both players
  // and the later choices are dropped (overrideTo). What the setup put on the table after that step leaves it
  // the same way as for Restart setup (removeSetupPieces). Deploy Lock goes off with the squads.
  function handleSetupOverride(step) {
    const removal = overrideRemoval(setup, step)
    const text = removal.squads || removal.crisis ? ` ${SETUP_REMOVAL}` : ''
    if (!window.confirm(`Go back to this step and drop the later choices?${text}`)) return
    table.transact(() => {
      removeSetupPieces(removal)
      if (removal.squads) setDeployLine(false)
      setSetup(overrideTo(setup, step))
      if (step === 'rollOff') clearPriorityMarker()
      writeLog('override', { step })
    })
    setOpenRoster(null)
  }

  // The roll off is over: `team` has Priority. Both players can press it in a multiplayer room, because
  // players can agree on a roll off with real dice.
  function handleSetupPriority(team) {
    if (setupStep(setup) !== 'rollOff') return
    table.transact(() => {
      setSetup(setPriority(setup, team))
      setPriorityField(team)
      writeLog('rollOff', { side: team, manual: true })
    })
  }

  // The player with Priority uses their deck of `type`. The draws are random, so they are made here, outside
  // a state updater, which React can call twice.
  function handleSetupDeck(type) {
    const team = priorityOf(setup)
    if (setupStep(setup) !== 'deck' || !parsedRosters[team]) return
    table.transact(() => {
      setSetup(chooseDeck(setup, type, parsedRosters[team][type]))
      writeLog('deck', { side: team, type })
    })
  }

  // A Use button on a drawn crisis card. After the first card, 2 cards are drawn from the other deck of
  // the other player.
  function handleSetupPick(code) {
    const step = setupStep(setup)
    if (step !== 'first' && step !== 'second') return
    const other = parsedRosters[otherTeam(priorityOf(setup))]
    const type = step === 'first' ? setup.deck.type : otherType(setup.deck.type)
    table.transact(() => {
      setSetup(pickCard(setup, code, other?.[otherType(setup.deck.type)] ?? []))
      writeLog('pick', { side: chooserOf(setup), type, card: rosterCard(code)?.name ?? code })
    })
  }

  function handleSetupThreat(threat) {
    if (setupStep(setup) !== 'threat') return
    table.transact(() => {
      setSetup(chooseThreat(setup, threat))
      writeLog('threat', { side: chooserOf(setup), threat })
    })
  }

  // Choose this edge: the mat stays as it is now. The two crisis cards of the mission go to the ends of
  // the scoring board, and their tokens to the mat. A card without files in the app has no tokens.
  function handleSetupEdge() {
    if (setupStep(setup) !== 'edge') return
    const missing = []
    table.transact(() => {
      for (const type of CRISIS_TYPES) {
        const info = rosterCard(setup.picks[type])
        if (!info?.key) missing.push(info?.name ?? setup.picks[type])
        handleCrisisChange(type, info?.key ?? null)
      }
      setSetup(chooseEdge(setup))
      writeLog('edge', { side: chooserOf(setup) })
    })
    if (missing.length > 0)
      showHudMessage(
        `The app has no files for ${missing.join(' and ')}, so ${missing.length === 1 ? 'its' : 'their'} tokens are not on the mat`,
      )
  }

  // Adds a character or Team Tactic card of the roster of `team` to the squad, or removes it. This is the
  // + / ✓ button on a roster card and the Add to squad button of the roster popup. Only a card that the app
  // can put on the table can join: a character with a model, a Team Tactic card with an image.
  function handleSquadToggle(team, tab, index) {
    if (squadBlock(team) || (tab !== 'characters' && tab !== 'tactics')) return
    const parsed = parsedRosters[team]
    const info = rosterCard(
      tab === 'characters' ? parsed.characters[index].code : parsed.tactics[index],
    )
    const current = hiddenSquads ? ownSquad : setup.squads[team]
    const joins = !current[tab].includes(index)
    if (joins && tab === 'characters' && !info.model) {
      showHudMessage(`No model for ${info.name} (${info.code}), so it cannot join the squad`)
      return
    }
    if (joins && tab === 'tactics' && !info.key) {
      showHudMessage(`No card image for ${info.name} (${info.code}), so it cannot join the squad`)
      return
    }
    writeSquad(
      team,
      toggleSquadCard({ squads: { [team]: current } }, team, tab, index).squads[team],
    )
  }

  // Writes the squad of `team`: into the document, or in a multiplayer room into the stored own squad
  function writeSquad(team, squad) {
    if (!hiddenSquads) {
      setSetup((prev) => ({ ...prev, squads: { ...prev.squads, [team]: squad } }))
      return
    }
    const record = { setupId: setup.id ?? null, squad }
    setStoredSquad(record)
    if (!saveSquad(userId, room.id, record))
      showHudMessage('This browser could not store your squad choice')
  }

  // Why a click on a squad of the Breakdown tab does not work for `team` now, or null when it works
  // (docs/features/squad-breakdown.md, "Choose a squad")
  function squadBlock(team) {
    return squadChoiceBlock(setup, team, { hidden: hiddenSquads, mySide })
  }

  // A click on a squad of the Breakdown tab: its characters become the squad, the Team Tactic cards stay.
  // Characters without a model are left out. Then the popup closes.
  function handleBreakdownChoose(team, places) {
    if (squadBlock(team)) return
    const characters = parsedRosters[team].characters
    const missing = []
    const joined = []
    for (const place of places) {
      const info = rosterCard(characters[place].code)
      if (info.model) joined.push(place)
      else missing.push(`${info.name} (${info.code})`)
    }
    if (missing.length > 0)
      showHudMessage(
        `No model for ${missing.join(' and ')}, so ${missing.length === 1 ? 'it' : 'they'} cannot join the squad`,
      )
    const current = hiddenSquads ? ownSquad : setup.squads[team]
    writeSquad(team, setSquadCharacters({ squads: { [team]: current } }, team, joined).squads[team])
    setOpenRoster(null)
  }

  // The Ready toggle of a player. Ready works when the squad has a character and its threat is not above the
  // Maximum Threat. While the player is Ready, their squad does not change. It writes only the toggle. When
  // both players are Ready, the effect below puts the squads on the table.
  function handleSquadReady(team) {
    if (setupStep(setup) !== 'squads' || (hiddenSquads && team !== mySide)) return
    // A placed squad is on the table for good
    if (placedSides(setup)[team]) return
    if (!setup.ready[team]) {
      const squad = hiddenSquads ? ownSquad : setup.squads[team]
      const problem = squadProblem({
        threat: squadThreat(parsedRosters[team], squad.characters),
        count: squad.characters.length,
        maxThreat: setup.threat,
      })
      if (problem) return
    }
    table.transact(() => {
      setSetup((prev) => toggleReady(prev, team))
      writeLog('ready', { side: team, ready: !setup.ready[team] })
    })
  }

  // The squad of `side` is revealed and goes on the table: the characters get their trays and models, and
  // the Team Tactic cards go into the tactic tray. A character or a Team Tactic card that the player already
  // has on the table is not added again. One transaction: the squad, the cards and `placed`. The new
  // characters and cards are made before it, outside the state updaters, because the setup stores their ids
  // for a restart, and React can call an updater twice. When the squad has no affiliation to choose
  // (autoAffiliation), the same transaction sets it in the setup and in game.affiliations. Reads the
  // document, not React state.
  function revealSquad(side, squad) {
    const parsed = parseRosterText(table.rosters.read()[side]?.code ?? '')
    const newCharacters = []
    const newCards = []
    const onTable = table.characters.read()
    const cardsOnTable = table.tactics.read()
    for (const place of squad.characters) {
      const ch = characterByCode(parsed.characters[place]?.code)
      const there = [...onTable, ...newCharacters].some(
        (c) => c.key === ch?.slug && c.team === side,
      )
      if (ch?.available && !there)
        newCharacters.push(...makeCharacters(ch, side, { attached: parsed.characters[place].gems }))
    }
    for (const place of squad.tactics) {
      const key = rosterCard(parsed.tactics[place])?.key
      const cards = [...cardsOnTable, ...newCards]
      if (!key || cards.some((card) => card.key === key && card.team === side)) continue
      const slot = firstFreeSlot(side, cards)
      newCards.push({ id: crypto.randomUUID(), key, team: side, x: slot.x, z: slot.z, up: 'face' })
    }
    const newPiles = makeCardPiles(newCards)
    const auto = autoAffiliation(squadAffiliationKeys(parsed, squad.characters))
    table.transact(() => {
      setCharacters((prev) => [...prev, ...newCharacters])
      setTacticCards((prev) => [...prev, ...newCards])
      setTokenPiles((prev) => [...prev, ...newPiles])
      setSetup((prev) =>
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
      if (auto) setAffiliations((prev) => ({ ...prev, [side]: auto }))
      // Fixed ids: an effect reveals, and a second run must not add a second entry
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

  // The player of `side` chooses the affiliation of the squad at the step affiliation: the setup and the
  // VP marker, in one transaction. In a multiplayer room, only the own side.
  function handleSetupAffiliation(side, key) {
    if (setupStep(setup) !== 'affiliation') return
    if (hiddenSquads && side !== mySide) return
    const choices = squadAffiliationChoices(parsedRosters[side], setup.squads[side].characters)
    if (key !== DEFAULT_AFFILIATION && !choices.includes(key)) return
    table.transact(() => {
      setSetup((prev) => chooseAffiliation(prev, side, key))
      setAffiliations((prev) => ({ ...prev, [side]: key }))
      writeLog('affiliation', { side, affiliation: affiliationName(key) })
    })
  }

  // Both players are Ready: this browser reveals the squads of the sides it plays. The second Ready can come
  // from the other browser, so an effect does it. It reads the document and skips a placed side, so a second
  // run does nothing. With no stored squad of this setup (another device, cleared storage), the player is
  // not Ready any more and chooses again.
  useEffect(() => {
    const current = table.setup.read()
    // Both squads are placed, from this browser or the other one: Deploy Lock on, once (lockSet)
    if (deployLockDue(current)) {
      table.transact(() => {
        setSetup((prev) => lockWasSet(prev))
        setDeployLine(true)
      })
    }
    if (setupStep(current) !== 'reveal') return
    const stored = hiddenSquads ? { [mySide]: readSquad(userId, room.id) } : null
    const plan = revealPlan(current, hiddenSquads ? [mySide] : TEAMS, stored)
    if (plan.reveal.length === 0 && plan.missing.length === 0) return
    for (const { side, squad } of plan.reveal) revealSquad(side, squad)
    if (plan.reveal.length > 0) {
      if (hiddenSquads) {
        deleteSquad(userId, room.id)
        setStoredSquad(null)
      }
      setOpenRoster(null)
    }
    if (plan.missing.length > 0) {
      table.setup.set((prev) => ({ ...prev, ready: { ...prev.ready, [mySide]: false } }))
      showHudMessage('Your squad choice is not in this browser. Choose it again.')
    }
    // revealSquad and showHudMessage read the table and set state, so they need no dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup])

  const setupActions = {
    priority: handleSetupPriority,
    deck: handleSetupDeck,
    pick: handleSetupPick,
    threat: handleSetupThreat,
    turnMat: handleTurnMat,
    edge: handleSetupEdge,
    ready: handleSquadReady,
    affiliation: handleSetupAffiliation,
    restart: handleSetupRestart,
    browse: handleSetupBrowse,
    override: handleSetupOverride,
  }

  return {
    viewSetup,
    ownSquad,
    parsedRosters,
    setupActions,
    handleRosterLoad,
    handleRosterRemove,
    handleSquadToggle,
    squadBlock,
    handleBreakdownChoose,
  }
}
