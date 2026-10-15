import { useEffect, useMemo, useState } from 'react'
import { affiliationName, autoAffiliation } from '../scoreboard/affiliations.js'
import { createSetupActions } from './actions.js'
import {
  deployLockDue,
  lockWasSet,
  overrideRemoval,
  ownSquadOf,
  placedSides,
  placeSquad,
  revealPlan,
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
import { isEmptyRoster } from '../rosters/mct.js'
import { newCharacters as makeCharacters } from '../characters/newCharacter.js'
import {
  parseRosterText,
  rosterCard,
  squadAffiliationChoices,
  squadAffiliationKeys,
  squadThreat,
  unknownCodesMessage,
} from '../rosters/cards.js'

// What a restart of the game setup removes, for its confirm
const SETUP_REMOVAL =
  'The squads and the crisis cards that the game setup put on the table are removed.'

// The game setup: rosters, the setup steps, squads and the reveal (see docs/features/setup-game.md). It is
// called after useRollOffReader: effect E8 must run before the reveal effect E9 below.
export function useGameSetup({
  handleCharacterRemove,
  handleCrisisChange,
  handleTurnMat,
  hiddenSquads,
  makeCardPiles,
  mySide,
  room,
  rosters,
  setAffiliations,
  setCharacters,
  setDeployLine,
  setOpenRoster,
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
  // The document writes (setup/actions.js). Made every render: the character and crisis calls are new
  // functions each time.
  const actions = createSetupActions(table, {
    mySide,
    hiddenSquads,
    rosterCard,
    parseRosterText,
    affiliationChoices: squadAffiliationChoices,
    removeCharacter: handleCharacterRemove,
    changeCrisis: handleCrisisChange,
  })

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
    const { restarted, unknown } = actions.loadRoster(team, parsed)
    afterRestart()
    // The open card may not be in the new roster
    setOpenRoster((prev) => (prev?.team === team ? null : prev))
    if (unknown.length > 0) showHudMessage(unknownCodesMessage(unknown))
    else if (restarted) showHudMessage('Game setup started again')
  }

  function handleRosterRemove(team) {
    if (!confirmSetupRemoval('Remove this roster')) return
    const { restarted } = actions.removeRoster(team)
    afterRestart()
    setOpenRoster((prev) => (prev?.team === team ? null : prev))
    if (restarted) showHudMessage('Game setup started again')
  }

  // After a restart of the setup, the squad that this browser stored for it is gone
  function afterRestart() {
    if (!hiddenSquads) return
    deleteSquad(userId, room.id)
    setStoredSquad(null)
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

  // The Restart setup button (GameSetup.jsx)
  function handleSetupRestart() {
    if (!window.confirm(`Start the game setup again? ${SETUP_REMOVAL}`)) return
    actions.restart()
    afterRestart()
  }

  // The Override button of a browsed step, after a confirm (actions.override)
  function handleSetupOverride(step) {
    const removal = overrideRemoval(table.setup.read(), step)
    const text = removal.squads || removal.crisis ? ` ${SETUP_REMOVAL}` : ''
    if (!window.confirm(`Go back to this step and drop the later choices?${text}`)) return
    actions.override(step)
    setOpenRoster(null)
  }

  // The deployment edge: the HUD names a crisis card that has no files in the app
  function handleSetupEdge() {
    const { missing } = actions.edge()
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

  // What the panel on the table calls (GameSetup.jsx): the document actions, and the ones with a confirm, a
  // message or local state
  const setupActions = {
    priority: actions.priority,
    deck: actions.deck,
    pick: actions.pick,
    threat: actions.threat,
    turnMat: handleTurnMat,
    edge: handleSetupEdge,
    ready: handleSquadReady,
    affiliation: actions.affiliation,
    restart: handleSetupRestart,
    browse: actions.browse,
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
