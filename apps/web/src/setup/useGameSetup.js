import { useEffect, useMemo, useState } from 'react'
import { useLatest } from '../scene/useLatest.js'
import { createSetupActions, deployLockWrite } from './actions.js'
import {
  overrideRemoval,
  ownSquadOf,
  revealPlan,
  setupPlacedCards,
  setSquadCharacters,
  setupStep,
  squadChoiceBlock,
  toggleSquadCard,
  TEAMS,
  viewerSetup,
} from './setup.js'
import { characterByCode } from '../characters/characters.js'
import { deleteSquad, readSquad, saveSquad } from '../rooms/store.js'
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
  crisisActions,
  characterActions,
  handleTurnMat,
  hiddenSquads,
  makeCardPiles,
  mySide,
  room,
  rosters,
  setOpenRoster,
  setSelection,
  setup,
  showHudMessage,
  table,
  userId,
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
    characters: characterActions,
    crisis: crisisActions,
    squadThreat,
    squadAffiliationKeys,
    characterByCode,
    newCharacters: makeCharacters,
    makeCardPiles,
  })

  // The crisis tokens of the setup are replaced by a restart, an Override and the Edge step, so a selected token
  // may be gone (it used to clear with the crisis change). A selected character is not affected.
  function clearTokenSelection() {
    setSelection((prev) => prev.filter((p) => p.kind !== 'token'))
  }

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
    if (restarted) clearTokenSelection()
    // The open card may not be in the new roster
    setOpenRoster((prev) => (prev?.team === team ? null : prev))
    if (unknown.length > 0) showHudMessage(unknownCodesMessage(unknown))
    else if (restarted) showHudMessage('Game setup started again')
  }

  function handleRosterRemove(team) {
    if (!confirmSetupRemoval('Remove this roster')) return
    const { restarted } = actions.removeRoster(team)
    afterRestart()
    if (restarted) clearTokenSelection()
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
    clearTokenSelection()
  }

  // The Override button of a browsed step, after a confirm (actions.override)
  function handleSetupOverride(step) {
    const removal = overrideRemoval(table.setup.read(), step)
    const text = removal.squads || removal.crisis ? ` ${SETUP_REMOVAL}` : ''
    if (!window.confirm(`Go back to this step and drop the later choices?${text}`)) return
    actions.override(step)
    clearTokenSelection()
    setOpenRoster(null)
  }

  // The deployment edge: the HUD names a crisis card that has no files in the app
  function handleSetupEdge() {
    const { missing } = actions.edge()
    clearTokenSelection()
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
    if (!hiddenSquads) {
      actions.toggleSquad(team, tab, index)
      return
    }
    storeSquad(
      team,
      toggleSquadCard({ squads: { [team]: current } }, team, tab, index).squads[team],
    )
  }

  // Stores the own squad of a multiplayer room in this browser, until the reveal
  function storeSquad(team, squad) {
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
    if (hiddenSquads) {
      storeSquad(
        team,
        setSquadCharacters({ squads: { [team]: ownSquad } }, team, joined).squads[team],
      )
    } else actions.chooseBreakdown(team, joined)
    setOpenRoster(null)
  }

  // The Ready toggle of a player. Ready works when the squad has a character and its threat is not above the
  // Maximum Threat. While the player is Ready, their squad does not change. It writes only the toggle. When
  // both players are Ready, the effect below puts the squads on the table.
  function handleSquadReady(team) {
    actions.ready(team, hiddenSquads ? ownSquad : undefined)
  }

  // Both players are Ready: this browser reveals the squads of the sides it plays. The second Ready can come
  // from the other browser, so an effect does it. It reads the document and skips a placed side, so a second
  // run does nothing. With no stored squad of this setup (another device, cleared storage), the player is
  // not Ready any more and chooses again.
  function revealWhenReady() {
    // Both squads are placed, from this browser or the other one: Deploy Lock on, once (lockSet)
    deployLockWrite(table)
    const current = table.setup.read()
    if (setupStep(current) !== 'reveal') return
    const stored = hiddenSquads ? { [mySide]: readSquad(userId, room.id) } : null
    const plan = revealPlan(current, hiddenSquads ? [mySide] : TEAMS, stored)
    if (plan.reveal.length === 0 && plan.missing.length === 0) return
    for (const { side, squad } of plan.reveal) actions.revealSquad(side, squad)
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
  }
  const latestReveal = useLatest(revealWhenReady)
  // Runs on a change of the setup only. It is the newest revealWhenReady: it reads the table, not render state.
  useEffect(() => {
    latestReveal.current()
  }, [setup, latestReveal])

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
