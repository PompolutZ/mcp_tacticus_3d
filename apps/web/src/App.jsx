import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { SceneBoundary } from './crash/SceneBoundary.jsx'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { assetUrl } from './assets/index.js'
import { tacticCardBack } from './tactics/files.js'
import Scene from './components/Scene.jsx'
import SelectionOutlines from './components/SelectionOutlines.jsx'
import { DEFAULT_SIDE_COLORS, setSideColors } from './sideColors.js'
import { Toolbar } from './components/Toolbar.jsx'
import { Library } from './components/Library.jsx'
import { LogPanel } from './components/LogPanel.jsx'
import { logWriter } from './log/writer.js'
import { useHovered } from './useHovered.js'
import { deleteTarget, flipTarget } from './hover.js'
import { useTableKeys } from './useTableKeys.js'
import { useCardPeek } from './components/useCardPeek.js'
import { usePing } from './components/usePing.js'
import { useSelection } from './useSelection.js'
import { useLogOpen } from './log/useLogOpen.js'
import { useNames } from './setup/useNames.js'
import { KeyboardCamera } from './components/KeyboardCamera.jsx'
import { WheelCamera } from './components/WheelCamera.jsx'
import { LoadingOverlay } from './components/LoadingOverlay.jsx'
import { Preload, Ready } from './components/Preload.jsx'
import { TokenPanel } from './components/TokenPanel.jsx'
import { CardPopup } from './components/CardPopup.jsx'
import { TrayPopup } from './components/TrayPopup.jsx'
import { RosterPopupHost } from './components/RosterPopupHost.jsx'
import { CrisisCompare } from './components/CrisisCompare.jsx'
import { CrisisChoose } from './components/CrisisChoose.jsx'
import { useAutoOpen } from './setup/useAutoOpen.js'
import { useTokenDrag } from './drag/useTokenDrag.js'
import { cancelActiveDrag, isDragActive } from './drag/pointerDrag.js'
import { characterOnBoard, isConstructId, modelCharacterId } from './characters/models.js'
import { isSoftwareRenderer, rendererName } from './renderer.js'
import { parseRosterText, rosterCard, rosterTabs } from './rosters/cards.js'
import {
  chooserOf,
  colorOf,
  priorityOf,
  rackHiddenSides,
  setupStep,
  viewOf,
} from './setup/setup.js'
import { useRollOffReader } from './setup/useRollOffReader.js'
import { useGameSetup } from './setup/useGameSetup.js'
import { setTableActions } from './table/actions.js'
import { gamePriority, priorityTitle } from './game/priority.js'
import { useHudTop } from './useHudTop.js'
import FrameStats from './debug/FrameStats.jsx'
import { DebugPanel } from './debug/DebugPanel.jsx'
import { withPlacements } from './rooms/table.js'
import { tableFiles } from './rooms/preload.js'
import { useYField, useYList, useYRecord } from './net/useY.js'
import { useTableTools } from './tabletools/useTableTools.js'
import { useSettings } from './settings/useSettings.js'
import { CAMERA_MOUSE_BUTTONS, MAX_POLAR_ANGLE, resetView, startView } from './camera.js'
import { canvasEvents } from './components/canvasEvents.js'
import { tableSeat } from './rooms/seat.js'
import { useCrisisTokens } from './crisis/useCrisisTokens.js'
import { useCharacterActions } from './characters/useCharacterActions.js'
import { useTablePieces } from './pieces/useTablePieces.js'
import { usePhaseActions } from './game/usePhaseActions.js'
import SpectatorColumns from './components/SpectatorColumns.jsx'
import HudNotice from './components/HudNotice.jsx'
import { PhaseButtons } from './components/PhaseButtons.jsx'
import { HudWarnings } from './components/HudWarnings.jsx'
import { useHudMessage } from './components/useHudMessage.js'
import { useDebugLook } from './debug/useDebugLook.js'
import { useLogSounds } from './log/useLogSounds.js'
import { useRemoteDropSounds } from './tokens/useRemoteDropSounds.js'
import { SettingsPopup } from './components/SettingsPopup.jsx'
import { NO_PIECES, selectedId } from './selection.js'

// Draco decoder is served from public/draco, not from the default Google CDN. Module scope of the table
// chunk, so it runs before any model loads.
useGLTF.setDecoderPath('/draco/')

// A character token drag starts only after the pointer moves this many pixels, so a click on a
// Give source or a token on the table does not drop a token.

// One table: a room, or the Sandbox. Table.jsx opens the Yjs document of the table and mounts a new App for
// each, so nothing stays from the last table. table: the stores of the document (net/doc.js). The table
// state below comes from it, and each setter writes it (net/useY.js). A room stores the document in
// IndexedDB, the Sandbox keeps it in memory. room: the room record (rooms/store.js), or null for the
// Sandbox. A room has a fixed map. storageFailed: the room could not use IndexedDB, so it is not saved.
// serverWarning: the text of the warning when a multiplayer room is no longer saved on the server, or null.
// connection: { state, peer, versionMismatch, schemaMismatch, retry } of a multiplayer room (net/peer.js, Table.jsx), or null.
// userId: the id of the signed-in user, who owns the stored squad of a multiplayer room.
// ownership: the claims on pieces (net/ownership.js). The drags claim their piece through it.
// presence: what the players look at (net/presence.js). Scene writes the range mark; this writes the selection.
// live: the live hub of a multiplayer room (net/live.js), or null. It goes to Scene.
// onExit(): opens the lobby. See
// docs/features/rooms.md and docs/features/peer-to-peer.md, "Yjs document".
export default function App({
  table,
  room = null,
  storageFailed = false,
  serverWarning = null,
  connection = null,
  userId = null,
  ownership = null,
  presence = null,
  live = null,
  onExit,
}) {
  // The calls into Scene, set by Scene on every render, null before its first effect. See
  // components/sceneApi.js for the shape.
  const sceneApi = useRef(null)
  // The order of the hook calls matters, because the effects run in this order. The layout effects come
  // first. useRollOffReader (E8) comes before useGameSetup (E9): a remote update can carry a throw and a
  // setup change together, and E9 reads what E8 wrote. useTableKeys is last: its table of actions uses
  // what all the hooks above give.
  const seat = tableSeat(room)
  const { isGuest, ownSide, playedSides, hiddenSquads, mySide } = seat
  const { position: cameraPosition, target: cameraTarget } = startView(isGuest)
  // The rest poses of the models, live: Scene applies a pose that the other browser wrote
  const [poses] = useYRecord(table.poses)
  const [debugOn, setDebugOn] = useState(false)
  // The spectator view above each model (SpectatorBadge.jsx)
  const [spectator, setSpectator] = useState(false)
  const [matTurns, setMatTurns] = useYField(table.game, 'matTurns')
  const [mapId, setMapId] = useYField(table.game, 'mapId')
  // The terrain pieces on the mat, see mapTerrain in rooms/table.js. A new map replaces them. The document
  // stores each piece's index in the map data and its lock. setTerrain writes only these.
  const [storedTerrain, setTerrain] = useYList(table.terrain)
  const terrain = useMemo(() => withPlacements(mapId, storedTerrain), [mapId, storedTerrain])
  const [deployLine, setDeployLine] = useYField(table.game, 'deployLine')
  const [characters] = useYList(table.characters)
  // The chosen Secure and Extract card, by key. null = none.
  const [crisis] = useYField(table.game, 'crisis')
  // Every crisis token on the table: the mat tokens of the cards (buildMatTokens) and the supply
  // tokens that players took from a pile (supplyToken).
  const [tokens] = useYList(table.tokens)
  // Scoring board markers: { host, guest, round } → { x, z } on the table (see ScoreBoard.jsx)
  const [scoreMarkers, setScoreMarkers] = useYField(table.game, 'scoreMarkers')
  // The Priority marker (game/priority.js): the raw field, null | side. A document from before the marker
  // has none, and gamePriority reads the roll-off winner then (after setup below).
  const [storedPriority] = useYField(table.game, 'priority')
  // Loaded rosters: { host, guest } → null | { code }, code in Jarvis format (see rosters/mct.js). A room
  // starts with its rosters: Blue, and Red when the room has it.
  const [rosters] = useYRecord(table.rosters)
  // The guest's roster comes from the server record (docs/features/auth.md, "Rosters"). At the first open, the key of
  // the own seat is empty, so it gets the roster. Only that key is written. Nothing restarts the setup: it
  // restarts only in handleRosterLoad and handleRosterRemove, and a roster that appears in an empty key
  // changes no card that the setup chose.
  useEffect(() => {
    if (!room?.multiplayer) return
    const roster = room.rosters?.[room.side]
    if (roster && !table.rosters.read()[room.side]) table.rosters.setField(room.side, roster)
  }, [table, room])
  // The game setup: crisis cards, threat, deployment edge and squads (setup/setup.js, GameSetup.jsx). A new
  // roster starts it again.
  const [setup] = useYRecord(table.setup)
  // The colors of the sides (setup/setup.js, colorOf). The Sandbox (no room) keeps +z Blue. The store gives
  // them to every component that shows a color (sideColors.js).
  const followPriority = Boolean(room)
  const hostColor = colorOf('host', setup, followPriority)
  useLayoutEffect(() => {
    setSideColors({ host: hostColor, guest: hostColor === 'blue' ? 'red' : 'blue' })
    return () => setSideColors(DEFAULT_SIDE_COLORS)
  }, [hostColor])
  // The names of the players for the setup texts (setup/names.js): the room players and the hello of the peer
  const seatPlayers = useMemo(
    () => (room?.multiplayer ? { players: room.players, peer: connection?.peer ?? null } : null),
    [room, connection?.peer],
  )
  // The names of the sides in the Priority texts (setup/names.js)
  const nameCtx = useNames(mySide, seatPlayers)
  const priority = gamePriority({ priority: storedPriority }, setup)
  // Affiliation token that each player's VP marker shows: { host, guest } → key in scoreboard/affiliations.json.
  // No toolbar control: the game setup sets it, when a squad is placed and at the step affiliation (see
  // docs/features/setup-game.md).
  const [affiliations] = useYField(table.game, 'affiliations')
  // Selected pieces and tools, see selection.js. One character, one token, the range tool, the
  // movement tool, the Toward / Away tool and the Line of Sight tool can all be selected at the same time.
  const { selection, setSelection, selectedTools, setSelectedTools } = useSelection(presence)
  // What is under the pointer, for the keys (useHovered.js)
  const {
    hoveredRef,
    handlePieceHover,
    handleTerrainHover,
    handleHeldHover,
    handleTrayCardHover,
    handleLooseHover,
    handlePileHover,
    handleTacticHover,
    handleDiceTrayHover,
    current: hoveredNow,
  } = useHovered()
  const controlsRef = useRef(null)
  const wheelCameraRef = useRef(null)
  const { ownPing, handlePingKey } = usePing(presence, sceneApi)
  // The tools on the table (tabletools/useTableTools.js)
  const {
    tools,
    activeRange,
    activeMove,
    angleOn,
    angleSpawn,
    toolSpawn,
    toolDrag,
    toolDragPointRef,
    handleToolStore,
    handleRangeClick,
    handleMoveClick,
    handleAngleClick,
    handleEscape,
    clearTools,
    handleAngleKey,
    handleLosKey,
    handleLosClick,
    handleToolKey,
    placeTool,
    startToolDrag,
    handleToolReturn,
  } = useTableTools({
    table,
    ownSide,
    playedSides,
    characters,
    selection,
    setSelection,
    selectedTools,
    setSelectedTools,
    hoveredRef,
    sceneApi,
    controlsRef,
  })
  // Crisis card image open in the full-screen popup: { src, alt } | null, see CardPopup.jsx.
  const [openCard, setOpenCard] = useState(null)
  // Id of the character whose whole tray is open in the full-screen popup, or null (see
  // TrayPopup.jsx). At most one of openCard, openTrayId and openRoster is set: each popup covers the table.
  const [openTrayId, setOpenTrayId] = useState(null)
  // Roster open in the full-screen popup, see RosterPopup.jsx: { team, tab, index } | null. tab: a key
  // of ROSTER_TABS (rosters/cards.js), index: the card shown in that tab.
  const [openRoster, setOpenRoster] = useState(null)
  // The crisis compare overlay of the setup, see CrisisCompare.jsx: { team, type, code } | null. team, type,
  // code: the card that gives the first tab and the first slide (code null: the first card). Also one of the
  // popups: each covers the table.
  const [openCrisis, setOpenCrisis] = useState(null)
  // The Choose 1 overlay: the key "<setup id>:<step>" of the step it is open for, or null. It shows only
  // while the setup is at that step, so a step change closes it. See CrisisChoose.jsx.
  const [openChoose, setOpenChoose] = useState(null)
  // The function that the open compare overlay puts here: shows the card `step` places away in the top carousel
  const crisisStepRef = useRef(null)
  // The open "Change to" menu of a shelf die, at most one across both
  // trays: { trayKey, dieId } | null. Lifted here, not into DiceKeys, so Escape can close it (see
  // keyAction in keyboard.js).
  const [diceMenu, setDiceMenu] = useState(null)
  // The Library HUD panel (see Library.jsx), toggled by its toolbar button.
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [logOpen, setLogOpen] = useLogOpen()
  const [rolls] = useYList(table.rolls)
  const [log] = useYList(table.log)

  const { writeLog, writeStatLog, characterLogData, tokenEntryData, writeHeldLog } = logWriter(
    table,
    mySide,
  )
  const { hudMessage, showHudMessage } = useHudMessage()
  // Name of the WebGL renderer when it runs on the CPU, see renderer.js. null: the graphics card draws, or
  // the player closed the warning.
  const [softwareRenderer, setSoftwareRenderer] = useState(null)
  // Character tokens that lie on the table: [{ id, key, x, z }]. A player drops them there from a
  // Give source, a pile or the Library, and drags them on to a character or another place. See
  // docs/features/character-trays.md, "Give tokens by drag and drop".
  const [looseTokens, setLooseTokens] = useYList(table.looseTokens)
  // Piles of character tokens on the table, dropped from the Library in Pile mode: [{ id, key, x, z }].
  // A pile never runs out. See docs/features/library.md, "Pile".
  const [tokenPiles, setTokenPiles] = useYList(table.tokenPiles)
  // Team Tactic cards on the table: [{ id, key, team, x, z, up }]. The order is the stack order: the
  // last card lies on top. See docs/features/team-tactic-cards.md, "State".
  const [tacticCards, setTacticCards] = useYList(table.tactics)
  const { peekCard, handleCardHover, altDown, altUp } = useCardPeek()
  const { settings, bindings, updateSettings } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  // The Sandbox Setup panel under the toolbar (Toolbar.jsx). Esc closes it as a popup.
  const [setupOpen, setSetupOpen] = useState(false)
  const hudRootRef = useRef(null)
  useHudTop(hudRootRef)
  // A token put on a character sounds in both browsers (log/useLogSounds.js)
  useLogSounds(log)
  // A token that the other player puts down on the table sounds here (tokens/useRemoteDropSounds.js)
  useRemoteDropSounds(table, ownership)
  // Dropped objective tokens, the crisis tokens and the notice (crisis/useCrisisTokens.js)
  const {
    crisisActions,
    waitLines,
    removeWaits,
    handleCrisisChange,
    handleTokenMove,
    handleTokenTurn,
    handleTokenFlip,
    handleTokenControl,
    handleTokenDamage,
    handleTokenHold,
    handleSupplyTake,
    handleHeldRemove,
    dropWait,
    placeTokens,
    handleNoticeShow,
  } = useCrisisTokens({
    table,
    playedSides,
    nameCtx,
    characters,
    tokens,
    setSelection,
    writeLog,
    characterLogData,
    writeHeldLog,
    placeTool,
    sceneApi,
    controlsRef,
    wheelCameraRef,
  })
  // The character handlers (characters/useCharacterActions.js)
  const {
    handleSpawn,
    handleCharacterDamage,
    handleCharacterPower,
    handleCharacterFlip,
    handleCharacterOffBoard,
    handleTrayCardDelete,
    handleCharacterRemove,
    handleCharacterTokenGive,
    handleCharacterTokenRemove,
  } = useCharacterActions({
    table,
    room,
    setup,
    characters,
    crisisActions,
    setSelection,
    setOpenTrayId,
    showHudMessage,
    writeLog,
    writeStatLog,
    characterLogData,
    tokenEntryData,
    dropWait,
    removeWaits,
    sceneApi,
  })
  const {
    handleTurnMat,
    handleMapChange,
    handleLockKey,
    handleTerrainRemove,
    handleLooseRemove,
    handlePileRemove,
    handleTacticSpawn,
    handleTacticMove,
    handleTacticFlip,
    handleTacticRemove,
    makeCardPiles,
  } = useTablePieces({
    table,
    terrain,
    sceneApi,
    setMatTurns,
    setMapId,
    setTerrain,
    setSelection,
    setLooseTokens,
    setTokenPiles,
    setTacticCards,
    showHudMessage,
  })
  const toolsOnTable = (item) => settings.tools[item] === 'table'
  // The own rack is on the table, so a tool dropped on it goes back to it
  const rackShown = toolsOnTable('rack')
  // Live pose getters of the dragged pieces without a body, piece key → getter. Drag code fills it, LiveSync reads it.
  const [pieceLives] = useState(() => new Map())
  const versionMismatch = Boolean(connection?.versionMismatch)
  const schemaMismatch = Boolean(connection?.schemaMismatch)
  // The files to load before the table shows: the map and the models (rooms/preload.js). Read once.
  const [preloadFiles] = useState(() => tableFiles({ mapId, terrain, characters, rosters }))
  // The scene and the preloaded files are in, so the loading screen hides (Preload.jsx, Ready)
  const [ready, setReady] = useState(false)

  // ← Lobby in the toolbar. A room is stored at each change (Table.jsx). The Sandbox is not saved, so it
  // asks first.
  function handleLobby() {
    if (!room && !window.confirm('Leave the Sandbox? Its table is not saved.')) return
    onExit()
  }

  // Opens the "Change to" menu of one shelf die. Opening one closes any other.
  function handleDiceMenuOpen(trayKey, dieId) {
    setDiceMenu({ trayKey, dieId })
  }

  function handleDiceMenuClose() {
    setDiceMenu(null)
  }

  // Moves the camera back to the start view at once
  function resetCamera() {
    resetView(controlsRef.current, wheelCameraRef.current, startView(isGuest))
  }

  // F, as in TTS: flips the crisis token under the pointer (also one that a character holds), the
  // card of the character under the pointer (its model or its tray card), or the tactic card under
  // the pointer. With nothing under the pointer, it flips the token or character selected last (the
  // card of a character). A token without a back does not flip (handleTokenFlip).
  function handleFlipKey() {
    const piece = flipTarget(hoveredNow(), selection)
    if (piece?.kind === 'token') handleTokenFlip(piece.id)
    // A character piece is a model; a second model has its own id (characters/models.js)
    // A construct has no card to flip
    else if (piece?.kind === 'character' && !isConstructId(piece.id))
      handleCharacterFlip(modelCharacterId(piece.id))
    else if (piece?.kind === 'tactic') handleTacticFlip(piece.id)
  }

  const {
    handlePowerPhase,
    powerBlockTitle,
    cleanupDisabled,
    cleanupTitle,
    handleCleanupPhase,
    handlePriorityClick,
  } = usePhaseActions({
    table,
    room,
    setup,
    characters,
    poses,
    nameCtx,
    writeLog,
    showHudMessage,
  })

  useRollOffReader({ table, rolls, mySide })
  const {
    viewSetup,
    ownSquad,
    parsedRosters,
    setupActions,
    handleRosterLoad,
    handleRosterRemove,
    handleSquadToggle,
    squadBlock,
    handleBreakdownChoose,
  } = useGameSetup({
    crisisActions,
    characterActions: { remove: handleCharacterRemove },
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
  })
  // The panels on the table read the actions from the store (table/actions.js)
  useLayoutEffect(() => {
    setTableActions({
      setup: setupActions,
      characters: {
        spawn: handleSpawn,
        damage: handleCharacterDamage,
        power: handleCharacterPower,
        flip: handleCharacterFlip,
        offBoard: handleCharacterOffBoard,
        removeToken: handleCharacterTokenRemove,
      },
      phases: {
        power: handlePowerPhase,
        cleanup: handleCleanupPhase,
        priorityClick: handlePriorityClick,
      },
    })
    return () => setTableActions(null)
  })

  // A click on a roster card: { team, tab, index }. The popup opens only on a card with an image. For a card
  // without one, the HUD shows what the app is missing. A character without an image also has no model.
  function handleRosterOpen(open) {
    const card = rosterTabs(parseRosterText(rosters[open.team].code))[open.tab][open.index]
    const info = rosterCard(card.code)
    if (info.image) {
      setOpenRoster(open)
      return
    }
    const missing = info.kind === 'character' ? 'No card image or model' : 'No card image'
    showHudMessage(`${missing} for ${info.name} (${info.code})`)
  }

  // The compare overlay shows in the steps that have crisis cards on the table. After them it is gone.
  const crisisShown =
    openCrisis && ['rollOff', 'deck', 'first', 'second'].includes(setupStep(viewSetup))
      ? openCrisis
      : null

  // The Choose 1 overlay shows in the first and second step, for the step it was opened in
  const chooseKey = ['first', 'second'].includes(setupStep(setup))
    ? `${setup.id}:${setupStep(setup)}`
    : null
  const chooseShown = !!chooseKey && openChoose === chooseKey && !viewOf(setup)

  function openChooseOverlay() {
    setOpenCard(null)
    setOpenTrayId(null)
    setOpenRoster(null)
    setOpenCrisis(null)
    setOpenChoose(chooseKey)
  }

  // A click on a crisis card of the setup: { team, type, code, drawn }. drawn: one of the 2 drawn cards that
  // the chooser picks from (first and second step): it opens the Choose 1 overlay, any other card the compare
  // overlay. This is the one place that decides what a crisis card click opens.
  function handleCrisisOpen({ team, type, code, drawn }) {
    if (drawn && chooseKey) {
      openChooseOverlay()
      return
    }
    setOpenCard(null)
    setOpenTrayId(null)
    setOpenRoster(null)
    setOpenChoose(null)
    setOpenCrisis({ team, type, code })
  }

  // Each overlay opens by itself once per step, on the screen of the chooser (the Sandbox and a single player
  // room: always). Browsing (setup.view) and a close do not open it again; a new setup id does.
  const bothRosters = !!parsedRosters.host && !!parsedRosters.guest
  const chooser = chooserOf(setup)
  const mine = !mySide || mySide === chooser
  const free = bothRosters && !viewOf(setup) && mine
  // Compare: the deck step, the Priority player (the chooser of that step)
  useAutoOpen(setupStep(setup) === 'deck' && free ? `${setup.id}:deck` : null, () =>
    handleCrisisOpen({ team: priorityOf(setup), type: 'secure', code: null }),
  )
  // Choose 1: the first and second step, the chooser
  useAutoOpen(free ? chooseKey : null, openChooseOverlay)

  // A click on a gem: a chip of a tray (TrayControls.jsx), the Library, or a gem line of a roster card: the card
  // face opens in the card popup. Reading changes nothing, so it works on any player's tray. The tray
  // popup closes, so only one popup is open. A card without an image shows what the app is missing.
  function handleAttachedOpen(code) {
    const info = rosterCard(code)
    if (!info?.image) {
      showHudMessage(`No card image for ${info?.name ?? code} (${code})`)
      return
    }
    setOpenTrayId(null)
    setOpenCard({
      src: assetUrl(info.faceKey ? tacticCardBack(info.faceKey) : info.image),
      alt: info.name,
      tacticKey: info.faceKey ?? undefined,
    })
  }

  // Shows the card `step` places away in the open tab of the roster popup. The tab is a loop: after the
  // last card comes the first.
  function handleRosterCardStep(step) {
    if (crisisShown) {
      crisisStepRef.current?.(step)
      return
    }
    setOpenRoster((prev) => {
      if (!prev || prev.tab === 'breakdown' || !rosters[prev.team]) return prev
      const count = rosterTabs(parseRosterText(rosters[prev.team].code))[prev.tab].length
      const index = (prev.index + step + count) % count
      return index === prev.index ? prev : { ...prev, index }
    })
  }

  // The token drag: starts, release, cancel (drag/useTokenDrag.js)
  const {
    tokenDrag,
    dragPointRef,
    findCharacterAt,
    handleTokenDragStart,
    handleLibraryTokenDragStart,
    handlePileTakeStart,
    handlePileMoveStart,
    handleSupplyDragStart,
  } = useTokenDrag({
    table,
    ownership,
    pieceLives,
    controlsRef,
    sceneApi,
    setLooseTokens,
    setTokenPiles,
    handleCharacterTokenGive,
    handleSupplyTake,
    handleLooseRemove,
  })

  const selectedTokenId = selectedId(selection, 'token')
  const selectedToken = tokens.find((t) => t.id === selectedTokenId) ?? null
  const openTray = openTrayId ? (characters.find((ch) => ch.id === openTrayId) ?? null) : null

  // The roster cards that have a + / ✓ button: { host, guest } → true, the own roster in the squad step
  const squadEdit = { host: !squadBlock('host'), guest: !squadBlock('guest') }

  // Debug mode is only in the dev server. import.meta.env.DEV is false in `vite build`, so debug
  // is always false there and the build leaves out the debug code.
  const debug = import.meta.env.DEV && debugOn
  const { mode, panel: debugPanel } = useDebugLook(debug)

  // Delete key: the handler for each kind of deleteTarget (hover.js)
  const deleteHandlers = {
    loose: handleLooseRemove,
    held: handleHeldRemove,
    pile: handlePileRemove,
    tactic: handleTacticRemove,
    terrain: handleTerrainRemove,
    trayCard: handleTrayCardDelete,
  }
  // A popup covers the table: the wheel, the table keys and the peek card stop
  const popupOpen = Boolean(
    openCard || openTrayId || openRoster || crisisShown || chooseShown || settingsOpen || setupOpen,
  )
  // The state for a mouse wheel step (WheelCamera.jsx): what keyAction reads, as the resolver needs it
  const wheelState = () => ({
    popup: popupOpen,
    dragging: !!(tokenDrag || toolDrag),
    overDiceTray: !!hoveredNow().diceTray,
    overPiece: !!hoveredNow().piece,
    bindings,
  })
  // The keys (keyboard.js, useTableKeys.js). The state is read at every key press. Last hook call: the
  // table of handlers uses what the hooks above give.
  const { heldPan, heldTurn, heldRotate } = useTableKeys({
    state: () => ({
      tokenDrag,
      toolDrag,
      modelDrag: (sceneApi.current?.modelDragId() ?? null) !== null,
      drag: isDragActive(),
      popup: popupOpen,
      rosterOpen: !!(openRoster || crisisShown),
      diceMenu,
      libraryOpen,
      logOpen,
      diceTray: hoveredNow().diceTray,
      overPiece: !!hoveredNow().piece,
      bindings,
    }),
    actions: {
      peek: (a) => altDown(a.blocked),
      cancelDrag: () => cancelActiveDrag(),
      closePopups: () => {
        setOpenCard(null)
        setOpenTrayId(null)
        setOpenRoster(null)
        setOpenCrisis(null)
        setOpenChoose(null)
        setSettingsOpen(false)
        setSetupOpen(false)
      },
      cardStep: (a) => handleRosterCardStep(a.step),
      closeDiceMenu: () => setDiceMenu(null),
      closeLibrary: () => setLibraryOpen(false),
      closeLog: () => setLogOpen(false),
      escape: () => handleEscape(),
      delete: () => {
        const target = deleteTarget(hoveredNow())
        if (target) deleteHandlers[target.kind](target.id)
      },
      reset: (a) => {
        if (a.first) resetCamera()
      },
      flip: () => handleFlipKey(),
      lift: () => sceneApi.current?.liftPiece(),
      floor: () => {
        const message = sceneApi.current?.floorPiece()
        if (message) showHudMessage(message)
      },
      lock: () => handleLockKey(),
      ping: () => handlePingKey(),
      dice: (a) => sceneApi.current?.addDice(a.side, a.count),
      range: (a) => handleToolKey('range', a.value),
      move: (a) => handleToolKey('move', a.value),
      angle: () => handleAngleKey(),
      los: () => handleLosKey(),
      clear: () => clearTools(),
    },
    turnPiece: (dir) => sceneApi.current?.turnPiece(dir),
    altUp,
  })

  return (
    <div ref={hudRootRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Holds the Canvas only: isolation: isolate (index.css) keeps every drei <Html> wrapper it
          mounts (terrain labels, the ruler tool, the tray controls) from ever drawing over the
          HUD below, no matter its z-index. See index.css, .scene-root. */}
      <div className="scene-root">
        <SceneBoundary>
          <Canvas
            shadows
            camera={{ position: cameraPosition, fov: 50 }}
            // The EffectComposer in SelectionOutlines renders the scene with its own antialiasing (multisampling)
            gl={{ antialias: false }}
            events={canvasEvents}
            // A click with no piece under the pointer (table, terrain, background) clears the selected
            // pieces. The selected tools stay selected.
            // R3F does not count a camera drag as a click. A right click is a 'contextmenu' event, and it also
            // starts a camera turn, so it does not clear. Clicks on tool buttons (Html) are not on the canvas.
            onPointerMissed={(e) => {
              if (e.type === 'click' && e.target instanceof HTMLCanvasElement)
                setSelection(NO_PIECES)
            }}
            onCreated={({ gl }) => {
              const name = rendererName(gl.getContext())
              if (isSoftwareRenderer(name)) setSoftwareRenderer(name)
            }}
          >
            {/* The scene mounts when these files are in, see Preload.jsx */}
            <Preload files={preloadFiles} />
            <SelectionOutlines composer={mode !== 'no-composer'} outlines={mode === 'full'}>
              <Scene
                apiRef={sceneApi}
                mapId={mapId}
                tableButtons={{
                  multiplayer: Boolean(room?.multiplayer),
                  show: {
                    power: toolsOnTable('power'),
                    cleanup: toolsOnTable('cleanup'),
                    deployLock: toolsOnTable('deployLock'),
                    matTurn: toolsOnTable('matTurn'),
                  },
                  powerBlockTitle,
                  cleanupDisabled,
                  cleanupTitle,
                  deployLine,
                  onDeployLineClick: () => setDeployLine((prev) => !prev),
                  onTurnMat: handleTurnMat,
                }}
                toolRack={
                  rackShown
                    ? {
                        multiplayer: Boolean(room?.multiplayer),
                        onRangeClick: handleRangeClick,
                        onMoveClick: handleMoveClick,
                        onAngleClick: handleAngleClick,
                        onLosClick: handleLosClick,
                        onDragStart: startToolDrag,
                      }
                    : null
                }
                terrain={terrain}
                onTerrainHover={handleTerrainHover}
                characters={characters}
                tools={tools}
                ownSide={ownSide}
                onToolStore={handleToolStore}
                onToolRemove={handleToolReturn}
                onToolReturn={
                  rackShown && !rackHiddenSides(setup, rosters).includes(ownSide)
                    ? handleToolReturn
                    : undefined
                }
                ownership={ownership}
                presence={presence}
                ownPing={ownPing}
                live={live}
                pieceLives={pieceLives}
                angleSpawn={angleSpawn}
                toolSpawn={toolSpawn}
                showColliders={debug}
                showLabels={settings.labels}
                turnStep={settings.turn.step}
                spectator={spectator}
                matTurns={matTurns}
                deployLine={deployLine}
                crisis={crisis}
                tokens={tokens}
                selection={selection}
                onSelectionChange={setSelection}
                selectedTools={selectedTools}
                onSelectedToolsChange={setSelectedTools}
                onPieceHover={handlePieceHover}
                onTokenMove={handleTokenMove}
                onTokenTurn={handleTokenTurn}
                onTokenHold={handleTokenHold}
                onHeldHover={handleHeldHover}
                onSupplyDragStart={handleSupplyDragStart}
                onTrayCardHover={handleTrayCardHover}
                onCardHover={handleCardHover}
                onTokenDragStart={handleTokenDragStart}
                looseTokens={looseTokens}
                onLooseHover={handleLooseHover}
                tokenPiles={tokenPiles}
                onPileTakeStart={handlePileTakeStart}
                onPileMoveStart={handlePileMoveStart}
                onPileHover={handlePileHover}
                tacticCards={tacticCards}
                onTacticMove={handleTacticMove}
                onTacticHover={handleTacticHover}
                tokenDrag={tokenDrag}
                dragPointRef={dragPointRef}
                toolDrag={toolDrag}
                toolDragPointRef={toolDragPointRef}
                onCardOpen={setOpenCard}
                onTrayOpen={setOpenTrayId}
                onAttachedOpen={handleAttachedOpen}
                diceMenu={diceMenu}
                onDiceMenuOpen={handleDiceMenuOpen}
                onDiceMenuClose={handleDiceMenuClose}
                findCharacterAt={findCharacterAt}
                playedSides={playedSides}
                removeWaits={removeWaits}
                onDiceTrayHover={handleDiceTrayHover}
                heldRotate={heldRotate}
                scoreMarkers={scoreMarkers}
                priority={priority}
                priorityTitle={priority ? priorityTitle(priority, nameCtx) : ''}
                affiliations={affiliations}
                rosters={rosters}
                parsedRosters={parsedRosters}
                onRosterOpen={handleRosterOpen}
                onCrisisOpen={handleCrisisOpen}
                setup={viewSetup}
                mySide={mySide}
                seatPlayers={seatPlayers}
                squadEdit={squadEdit}
                onSquadToggle={handleSquadToggle}
                onScoreMarkerMove={(marker, x, z) =>
                  setScoreMarkers((prev) => ({ ...prev, [marker]: { x, z } }))
                }
                poses={poses}
                startPose={table.poses.get}
                diceStore={table.dice}
                rollsStore={table.rolls}
                transact={table.transact}
                onModelRest={table.poses.setField}
              />
            </SelectionOutlines>
            <OrbitControls
              ref={controlsRef}
              makeDefault
              target={cameraTarget}
              enablePan={true}
              // WheelCamera takes every wheel event, so this is only the pinch on a touch screen
              enableZoom={true}
              enableRotate={true}
              minDistance={5}
              maxDistance={50}
              maxPolarAngle={MAX_POLAR_ANGLE}
              mouseButtons={CAMERA_MOUSE_BUTTONS}
            />
            <KeyboardCamera pan={heldPan} turn={heldTurn} />
            <WheelCamera
              ref={wheelCameraRef}
              wheelState={wheelState}
              onTurn={(dir) => sceneApi.current?.turnPiece(dir)}
            />
            {debug && <FrameStats />}
            <Ready onReady={() => setReady(true)} />
          </Canvas>
        </SceneBoundary>
      </div>
      <div className="hud-top">
        <Toolbar
          roomCode={room?.id ?? null}
          multiplayer={Boolean(room?.multiplayer)}
          guestSeatFree={Boolean(room?.multiplayer && (!room.players.host || !room.players.guest))}
          side={room?.side ?? null}
          players={room?.players ?? null}
          connection={connection}
          onLobby={handleLobby}
          mapId={mapId}
          onMapChange={handleMapChange}
          activeRange={activeRange}
          activeMove={activeMove}
          angleOn={angleOn}
          onRangeClick={handleRangeClick}
          onMoveClick={handleMoveClick}
          onAngleClick={handleAngleClick}
          spectator={spectator}
          onSpectatorClick={() => setSpectator((prev) => !prev)}
          onTurnMat={handleTurnMat}
          settings={settings}
          settingsOpen={settingsOpen}
          onSettingsClick={() => setSettingsOpen((prev) => !prev)}
          deployLine={deployLine}
          onDeployLineClick={() => setDeployLine((prev) => !prev)}
          crisis={crisis}
          onCrisisChange={handleCrisisChange}
          onRosterLoad={handleRosterLoad}
          onRosterRemove={handleRosterRemove}
          libraryOpen={libraryOpen}
          onLibraryClick={() => setLibraryOpen((prev) => !prev)}
          logOpen={logOpen}
          onLogClick={() => setLogOpen(!logOpen)}
          setupOpen={setupOpen}
          onSetupClick={() => setSetupOpen((prev) => !prev)}
          onSetupClose={() => setSetupOpen(false)}
        />
      </div>
      <TokenPanel
        token={selectedToken}
        onFlip={() => handleTokenFlip(selectedToken.id)}
        onControl={(control) => handleTokenControl(selectedToken.id, control)}
        onDamage={(damage) => handleTokenDamage(selectedToken.id, damage)}
      />
      <Library
        open={libraryOpen}
        characters={characters}
        seat={seat}
        onSpawnTactic={handleTacticSpawn}
        onGemOpen={handleAttachedOpen}
        onTokenDragStart={handleLibraryTokenDragStart}
      />
      <LogPanel
        open={logOpen}
        onOpen={() => setLogOpen(true)}
        onClose={() => setLogOpen(false)}
        rolls={rolls}
        log={log}
        mySide={mySide}
        seatPlayers={seatPlayers}
      />
      {spectator && (
        <SpectatorColumns
          characters={characters}
          tokens={tokens}
          poses={poses}
          setup={viewSetup}
          scoreMarkers={scoreMarkers}
          nameCtx={nameCtx}
          mySide={mySide}
          hiddenSquads={hiddenSquads}
          size={settings.spectator.size}
          libraryOpen={libraryOpen}
          logOpen={logOpen}
        />
      )}
      <CardPopup card={openCard} onClose={() => setOpenCard(null)} />
      {!(tokenDrag || toolDrag || popupOpen) && <CardPopup card={peekCard} peek />}
      {settingsOpen && (
        <SettingsPopup
          settings={settings}
          bindings={bindings}
          onSettingsChange={updateSettings}
          debug={debug}
          onDebugClick={() => setDebugOn((prev) => !prev)}
          showLabels={settings.labels}
          onLabelsClick={() => updateSettings({ labels: !settings.labels })}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {crisisShown && (
        <CrisisCompare
          open={crisisShown}
          setup={viewSetup}
          parsed={parsedRosters}
          ctx={nameCtx}
          mySide={mySide}
          stepRef={crisisStepRef}
          onChoose={setupActions.deck}
          onClose={() => setOpenCrisis(null)}
        />
      )}
      {chooseShown && (
        <CrisisChoose
          setup={setup}
          parsed={parsedRosters}
          ctx={nameCtx}
          onPick={setupActions.pick}
          onClose={() => setOpenChoose(null)}
        />
      )}
      <RosterPopupHost
        openRoster={openRoster}
        setOpenRoster={setOpenRoster}
        rosters={rosters}
        setup={setup}
        parsedRosters={parsedRosters}
        squadBlock={squadBlock}
        hiddenSquads={hiddenSquads}
        mySide={mySide}
        ownSquad={ownSquad}
        handleBreakdownChoose={handleBreakdownChoose}
        handleSquadToggle={handleSquadToggle}
      />
      {openTray && (
        <TrayPopup
          character={openTray}
          heldTokens={tokens.filter((tok) => tok.heldBy === openTray.id)}
          onClose={() => setOpenTrayId(null)}
          onDamage={(damage) => handleCharacterDamage(openTray.id, damage)}
          onPower={(power) => handleCharacterPower(openTray.id, power)}
          onFlip={() => handleCharacterFlip(openTray.id)}
          onRemove={() => handleCharacterOffBoard(openTray.id)}
          onBoard={characterOnBoard(openTray, poses)}
          removeWait={removeWaits[openTray.id] ?? null}
          onTokenRemove={(key) => handleCharacterTokenRemove(openTray.id, key)}
        />
      )}
      {hudMessage && <div className="hud-message">{hudMessage}</div>}
      <HudNotice
        lines={waitLines}
        onShow={handleNoticeShow}
        onDone={(line) => placeTokens(line.ids)}
      />
      <PhaseButtons
        settings={settings}
        onPowerPhase={() => handlePowerPhase(playedSides)}
        powerBlock={powerBlockTitle(playedSides)}
        onCleanupPhase={handleCleanupPhase}
        cleanupDisabled={cleanupDisabled}
        cleanupTitle={cleanupTitle}
      />
      <HudWarnings
        lifted={settings.tools.power === 'hud' || settings.tools.cleanup === 'hud'}
        storageFailed={storageFailed}
        serverWarning={serverWarning}
        versionMismatch={versionMismatch}
        schemaMismatch={schemaMismatch}
        softwareRenderer={softwareRenderer}
        onSoftwareRendererClose={() => setSoftwareRenderer(null)}
      />
      {debug && <DebugPanel {...debugPanel} />}
      <LoadingOverlay ready={ready} />
    </div>
  )
}
