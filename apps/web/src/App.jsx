import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { assetUrl } from './assets/index.js'
import Scene from './components/Scene.jsx'
import SelectionOutlines from './components/SelectionOutlines.jsx'
import { COLOR_NAME, DEFAULT_SIDE_COLORS, setSideColors } from './sideColors.js'
import { Toolbar } from './components/Toolbar.jsx'
import { Library } from './components/Library.jsx'
import { LogPanel } from './components/LogPanel.jsx'
import { addEntry, logEntry } from './log/log.js'
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
import { RosterPopup } from './components/RosterPopup.jsx'
import { startPointerDrag } from './drag/pointerDrag.js'
import { getCard } from './crisis/cards.js'
import { newCharacter } from './characters/newCharacter.js'
import { supplyPilePosition } from './crisis/layout.js'
import {
  characterByCode,
  characterIsGrunt,
  characterName,
  characterPowerBonus,
} from './characters/characters.js'
import { characterOnBoard, modelCharacterId } from './characters/models.js'
import { powerAfterPhase } from './characters/power.js'
import { cleanupBlockers, cleanupCharacter } from './characters/cleanup.js'
import { cleanupCrisisTokens } from './crisis/cleanup.js'
import { DEFAULT_AFFILIATION, affiliationName, autoAffiliation } from './scoreboard/affiliations.js'
import { ROUND_POINTS, nextRoundSpot } from './scoreboard/board.js'
import { isSoftwareRenderer, rendererName } from './renderer.js'
import { CLEANUP_KEYS } from './tokens/tokens.js'
import { firstFreeSlot, freePilePlaces, nearestFreeSlot, tacticTrayAt } from './tactics/layout.js'
import { getTactic } from './tactics/cards.js'
import { formatMctCode, isEmptyRoster } from './rosters/mct.js'
import { DEFAULT_FILTERS } from './rosters/breakdown.js'
import {
  CRISIS_THREATS,
  ROSTER_TABS,
  parseRosterText,
  rosterCard,
  rosterTabs,
  squadAffiliationKeys,
  squadThreat,
  unknownCodesMessage,
} from './rosters/cards.js'
import {
  CRISIS_TYPES,
  TEAMS,
  chooseAffiliation,
  browse,
  chooseDeck,
  chooserOf,
  colorOf,
  chooseEdge,
  chooseThreat,
  newSetup,
  finishDeploy,
  priorityOf,
  otherTeam,
  otherType,
  overrideRemoval,
  overrideTo,
  pickCard,
  placeSquad,
  deployLockDue,
  lockWasSet,
  placedSides,
  placedIds,
  possibleThreats,
  revealPlan,
  setupPlacedCards,
  setPriority,
  setRollOff,
  setupStep,
  setSquadCharacters,
  toggleReady,
  toggleSquadCard,
  viewOf,
} from './setup/setup.js'
import { readRollOff } from './setup/rollOff.js'
import { gamePriority, priorityAfterCleanup, priorityNote, priorityTitle } from './game/priority.js'
import { FACES } from './dice/faces.js'
import FrameStats from './debug/FrameStats.jsx'
import { DebugPanel } from './debug/DebugPanel.jsx'
import { TERRAIN_PIECES } from './terrain/pieces.js'
import { mapTerrain, withPlacements } from './rooms/table.js'
import { deleteSquad, readSquad, saveSquad } from './rooms/store.js'
import { tableFiles } from './rooms/preload.js'
import { useYField, useYList, useYRecord } from './net/useY.js'
import { dragPose, tokenDragKey } from './net/livePose.js'
import { useTableTools } from './tabletools/useTableTools.js'
import { useSettings } from './settings/useSettings.js'
import { playSound } from './sound.js'
import { CAMERA_MOUSE_BUTTONS, resetView, startView } from './camera.js'
import { canvasEvents } from './components/canvasEvents.js'
import { tableSeat } from './rooms/seat.js'
import { useCrisisTokens } from './crisis/useCrisisTokens.js'
import { useCharacterActions } from './characters/useCharacterActions.js'
import HudNotice from './components/HudNotice.jsx'
import { HudWarnings } from './components/HudWarnings.jsx'
import { useHudMessage } from './components/useHudMessage.js'
import { useDebugLook } from './debug/useDebugLook.js'
import { useLogSounds } from './log/useLogSounds.js'
import { useRemoteDropSounds } from './tokens/useRemoteDropSounds.js'
import { SettingsPopup } from './components/SettingsPopup.jsx'
import { NO_PIECES, deselectPiece, selectedId } from './selection.js'

// Dice that each player rolls in the roll off
const ROLL_OFF_DICE = 5
// A throw entry older than this (ms) is not a new throw
const ROLL_OFF_FRESH = 30000

// A character token drag starts only after the pointer moves this many pixels, so a click on a
// Give source or a token on the table does not drop a token.
const EMPTY_SQUAD = { characters: [], tactics: [] }

// What a restart of the game setup removes, for its confirm (restartSetup)
const SETUP_REMOVAL =
  'The squads and the crisis cards that the game setup put on the table are removed.'

// One table: a room, or the Sandbox. Table.jsx opens the Yjs document of the table and mounts a new App for
// each, so nothing stays from the last table. table: the stores of the document (net/doc.js). The table
// state below comes from it, and each setter writes it (net/useY.js). A room stores the document in
// IndexedDB, the Sandbox keeps it in memory. room: the room record (rooms/store.js), or null for the
// Sandbox. A room has a fixed map. storageFailed: the room could not use IndexedDB, so it is not saved.
// serverWarning: the text of the warning when a multiplayer room is no longer saved on the server, or null.
// connection: { state, peer, versionMismatch, retry } of a multiplayer room (net/peer.js, Table.jsx), or null.
// userId: the id of the signed-in user, who owns the stored squad of a multiplayer room.
// ownership: the claims on pieces (net/ownership.js). The drags claim their piece through it.
// presence: what the players look at (net/presence.js). Scene writes the range mark; this writes the selection.
// live: the live hub of a multiplayer room (net/live.js), or null. It goes to Scene.
// onExit(): opens the lobby. See
// docs/features/rooms.md and docs/plans/implement-backend/05-yjs-state.md.
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
  const { isGuest, ownSide, playedSides, hiddenSquads, mySide } = tableSeat(room)
  const { position: cameraPosition, target: cameraTarget } = startView(isGuest)
  // The rest poses of the models, live: Scene applies a pose that the other browser wrote
  const [poses] = useYRecord(table.poses)
  const [debugOn, setDebugOn] = useState(false)
  const [showLabels, setShowLabels] = useState(true)
  // The spectator view above each model (SpectatorBadge.jsx)
  const [spectator, setSpectator] = useState(false)
  const [matTurns, setMatTurns] = useYField(table.game, 'matTurns')
  const [mapId, setMapId] = useYField(table.game, 'mapId')
  // The terrain pieces on the mat, see mapTerrain in rooms/table.js. A new map replaces them. The document
  // stores each piece's index in the map data and its lock. setTerrain writes only these.
  const [storedTerrain, setTerrain] = useYList(table.terrain)
  const terrain = useMemo(() => withPlacements(mapId, storedTerrain), [mapId, storedTerrain])
  // Scene calls this and returns the id of the terrain piece under the pointer, locked or not, or
  // null. See Scene.jsx, terrainAt.
  const terrainAtRef = useRef(null)
  const [deployLine, setDeployLine] = useYField(table.game, 'deployLine')
  const [characters, setCharacters] = useYList(table.characters)
  // The chosen Secure and Extract card, by key. null = none.
  const [crisis, setCrisis] = useYField(table.game, 'crisis')
  // Every crisis token on the table: the mat tokens of the cards (buildMatTokens) and the supply
  // tokens that players took from a pile (supplyToken).
  const [tokens, setTokens] = useYList(table.tokens)
  // Scoring board markers: { host, guest, round } → { x, z } on the table (see ScoreBoard.jsx)
  const [scoreMarkers, setScoreMarkers] = useYField(table.game, 'scoreMarkers')
  // The Priority marker (game/priority.js): the raw field, null | side. A document from before the marker
  // has none, and gamePriority reads the roll-off winner then (after setup below).
  const [storedPriority, setPriorityField] = useYField(table.game, 'priority')
  // Loaded rosters: { host, guest } → null | { code }, code in Jarvis format (see rosters/mct.js). A room
  // starts with its rosters: Blue, and Red when the room has it.
  const [rosters, setRosters] = useYRecord(table.rosters)
  // The guest's roster comes from the server record (decision 10 of plan 07). At the first open, the key of
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
  const [setup, setSetup] = useYRecord(table.setup)
  // The colors of the sides (setup/setup.js, colorOf). The Sandbox (no room) keeps +z Blue. The store gives
  // them to every component that shows a color (sideColors.js).
  const followPriority = Boolean(room)
  const hostColor = colorOf('host', setup, followPriority)
  useLayoutEffect(() => {
    setSideColors({ host: hostColor, guest: hostColor === 'blue' ? 'red' : 'blue' })
    return () => setSideColors(DEFAULT_SIDE_COLORS)
  }, [hostColor])
  // The selected threat value of the Breakdown tab of each roster: { host, guest } → { code, threat, filters } |
  // null. code: the roster code it belongs to; null means the first value. Not saved. See
  // docs/features/squad-breakdown.md, "State".
  const [breakdownChoice, setBreakdownChoice] = useState({ host: null, guest: null })
  // The names of the players for the setup texts (setup/names.js): the room players and the hello of the peer
  const seatPlayers = useMemo(
    () => (room?.multiplayer ? { players: room.players, peer: connection?.peer ?? null } : null),
    [room, connection?.peer],
  )
  // The names of the sides in the Priority texts (setup/names.js)
  const nameCtx = useNames(mySide, seatPlayers)
  const priority = gamePriority({ priority: storedPriority }, setup)
  const [storedSquad, setStoredSquad] = useState(() =>
    hiddenSquads ? readSquad(userId, room.id) : null,
  )
  // The squad of the own side, and the setup as this player sees it: the other player's squad is empty
  // until it is placed. After the reveal it is in the document, and the affiliation step needs it.
  const ownSquad =
    storedSquad && storedSquad.setupId === (setup.id ?? null)
      ? storedSquad.squad
      : (setup.squads[mySide] ?? EMPTY_SQUAD)
  const viewSetup = useMemo(
    () =>
      hiddenSquads
        ? {
            ...setup,
            squads: {
              [mySide]: ownSquad,
              [otherTeam(mySide)]: placedSides(setup)[otherTeam(mySide)]
                ? setup.squads[otherTeam(mySide)]
                : EMPTY_SQUAD,
            },
          }
        : setup,
    [hiddenSquads, setup, mySide, ownSquad],
  )
  // Affiliation token that each player's VP marker shows: { host, guest } → key in scoreboard/affiliations.json.
  // No toolbar control: the game setup sets it, when a squad is placed and at the step affiliation (see
  // docs/features/setup-game.md).
  const [affiliations, setAffiliations] = useYField(table.game, 'affiliations')
  // Selected pieces and tools, see selection.js. One character, one token, the range tool, the
  // movement tool and the Toward / Away tool can all be selected at the same time.
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
  // Scene fills it: { atPointer(), atCenter() }, table points for a free tool spawn (ToolPoint.jsx)
  const toolPointRef = useRef(null)
  const { ownPing, handlePingKey } = usePing(presence, toolPointRef)
  // The tools on the table (tabletools/useTableTools.js)
  const {
    tools,
    activeRange,
    activeMove,
    angleOn,
    angleSpawn,
    toolSpawn,
    toolDrag,
    toolDragHandleRef,
    toolDragPointRef,
    handleToolStore,
    handleRangeClick,
    handleMoveClick,
    handleAngleClick,
    handleEscape,
    clearTools,
    handleAngleKey,
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
    toolPointRef,
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
  // Each own dice tray puts a function here by side: clears the tray, then adds that many dice. See
  // DiceTray.jsx.
  const addDiceRef = useRef({})
  // A token drag in progress: { tokenKey, looseId, giveId, supplyCard, pile, pileId, newId, key, active, start } | null.
  // newId: the id of the new piece of the drag (a new token, pile or supply token), else null. key: the piece
  // key of the dragged piece, `loose:`, `pile:` or `token:` (decision 22). looseId: the table token that is dragged, or null for a new token from a source. giveId: the character of the tray, when the press is on its Give source (a click gives it one token), else null. supplyCard: the
  // card key when the new token comes from the supply pile of a Source card (tokenKey is then a
  // crisis token key), otherwise null. pile: the drag brings a new pile from the Library. pileId: the
  // drag moves that pile (Shift + drag). active: the pointer has moved DRAG_THRESHOLD px, so the dragged token
  // shows under the pointer (Scene.jsx, TokenDragPreview). start: the pointer position at that
  // moment. The state changes only at start and when the drag becomes active, not on every
  // pointermove.
  const [tokenDrag, setTokenDrag] = useState(null)
  // The same drag without the active and start fields, for handleTokenRelease
  const tokenDragRef = useRef(null)
  // The drag code of the token drag: { cancel }, or null
  const tokenDragHandleRef = useRef(null)
  // The table point under the pointer, written by TokenDragPreview: { x, y, z } | null
  const dragPointRef = useRef(null)
  const { settings, handleSettingChange, handleVolumeChange } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  // A token put on a character sounds in both browsers (log/useLogSounds.js)
  useLogSounds(log)
  // A token that the other player puts down on the table sounds here (tokens/useRemoteDropSounds.js)
  useRemoteDropSounds(table, ownership)
  // Scene calls this with a character id and returns its live table position { x, z } (Rapier body
  // or model object, not the spawn position), or null. Used by handleTokenDrop. See Scene.jsx, modelPosition.
  const modelPositionRef = useRef(null)
  // Scene's returnModels: puts the models of a character back on its tray
  const returnModelsRef = useRef(null)
  // Dropped objective tokens, the crisis tokens and the notice (crisis/useCrisisTokens.js)
  const {
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
    handleDropCharacterTokens,
    dropWait,
    placeTokens,
    handleNoticeShow,
  } = useCrisisTokens({
    table,
    room,
    ownSide,
    playedSides,
    nameCtx,
    characters,
    crisis,
    setCrisis,
    tokens,
    setTokens,
    setup,
    setSelection,
    writeLog,
    characterLogData,
    writeHeldLog,
    placeTool,
    modelPositionRef,
    returnModelsRef,
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
    setCharacters,
    tokens,
    setSelection,
    setOpenTrayId,
    showHudMessage,
    writeLog,
    writeStatLog,
    characterLogData,
    tokenEntryData,
    handleDropCharacterTokens,
    dropWait,
    removeWaits,
    returnModelsRef,
  })
  const toolsOnTable = (item) => settings.tools[item] === 'table'
  // The own rack is on the table, so a tool dropped on it goes back to it
  const rackShown = toolsOnTable('rack')
  // Live pose getters of the dragged pieces without a body, piece key → getter. Drag code fills it, LiveSync reads it.
  const [pieceLives] = useState(() => new Map())
  // Scene calls this with (clientX, clientY) and returns the character id under the point, or
  // null. See Scene.jsx, characterAt.
  const characterAtRef = useRef(null)
  // Scene calls this with a direction for Q / E: it turns the dragged character or tool, else the
  // one under the pointer. See Scene.jsx, turnPiece.
  const turnPieceRef = useRef(null)
  // Scene calls this for R: it lifts the character under the pointer or puts it back down. See
  // Scene.jsx, liftPiece.
  const liftPieceRef = useRef(null)
  const versionMismatch = Boolean(connection?.versionMismatch)
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

  // direction: 1 turns the mat 90° counter-clockwise, -1 clockwise
  function handleTurnMat(direction) {
    setMatTurns((prev) => (prev + direction + 4) % 4)
  }

  // A new map brings its own terrain, all locked. The selected terrain piece is gone. One change of the
  // document, so no render shows the new map with the old terrain.
  function handleMapChange(id) {
    table.transact(() => {
      setMapId(id)
      setTerrain(mapTerrain(id))
    })
    setSelection((prev) => prev.filter((p) => p.kind !== 'terrain'))
  }

  // L, as in TTS: locks or unlocks the terrain piece under the pointer. A piece that gets locked is
  // deselected. A locked piece looks the same as an unlocked one, so the HUD message shows the new state.
  function handleLockKey() {
    const id = terrainAtRef.current?.()
    const piece = id && terrain.find((p) => p.id === id)
    if (!piece) return
    const locked = !piece.locked
    setTerrain((prev) => prev.map((p) => (p.id === id ? { ...p, locked } : p)))
    if (locked) setSelection((prev) => deselectPiece(prev, { kind: 'terrain', id }))
    showHudMessage(`${TERRAIN_PIECES[piece.piece].name} ${locked ? 'locked' : 'unlocked'}`)
  }

  // Delete key over an unlocked terrain piece. A locked piece gets no hover (Terrain.jsx), so it
  // cannot be removed. Models on the piece fall: Rapier wakes the bodies that touched its collider.
  function handleTerrainRemove(id) {
    setTerrain((prev) => prev.filter((p) => p.id !== id))
    setSelection((prev) => deselectPiece(prev, { kind: 'terrain', id }))
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
    else if (piece?.kind === 'character') handleCharacterFlip(modelCharacterId(piece.id))
    else if (piece?.kind === 'tactic') handleTacticFlip(piece.id)
  }

  // Power button in the toolbar and the Power Phase buttons on the table (docs/features/round-phases.md). Gives
  // the Power of the Power Phase to each non-Grunt character of `sides` that has a model on the mat. The
  // toolbar passes the played sides, a table button its own side. The updater form reads the list
  // now, not at the last render, so a change the other browser just made is kept. The updater runs
  // inside setCharacters, so gains is filled when the HUD message is built.
  function handlePowerPhase(sides) {
    const gains = []
    table.transact(() => {
      // The first Power Phase ends the deployment: the setup is done and Deploy Lock is off
      const current = table.setup.read()
      if (setupStep(current) === 'deploy') {
        setSetup((prev) => finishDeploy(prev))
        setDeployLine(false)
        writeLog('deployed', {}, `deployed:${current.id}`)
      }
      setCharacters((prev) =>
        prev.map((ch) => {
          if (!sides.includes(ch.team) || !characterOnBoard(ch, poses)) return ch
          if (characterIsGrunt(ch.key)) return ch
          const power = powerAfterPhase({
            power: ch.power,
            bonus: characterPowerBonus(ch.key, ch.side),
            gems: ch.attached,
            stun: ch.tokens?.stun ?? 0,
            poison: ch.tokens?.poison ?? 0,
            grunt: false,
          })
          gains.push({ side: ch.team, name: characterName(ch.key), from: ch.power, to: power })
          return { ...ch, power }
        }),
      )
      // One entry for each side that gained Power
      for (const side of sides) {
        const own = gains.filter((gain) => gain.side === side)
        if (own.length > 0)
          writeLog('power', {
            side,
            gains: own.map(({ name, from, to }) => ({ name, from, to })),
          })
      }
    })
    // With one side, the message names it
    const title =
      sides.length === 1
        ? `Power Phase (${COLOR_NAME[colorOf(sides[0], setup, Boolean(room))]})`
        : 'Power Phase'
    showHudMessage(
      gains.length === 0
        ? `${title}: none of your characters is on the board`
        : `${title}: ${gains.map((g) => `${g.name} ${g.from} → ${g.to}`).join(', ')}`,
      8000,
    )
  }

  // Cleanup chip state (docs/features/round-phases.md, decision 8): off while a character on the board has
  // neither Activated nor Dazed, and while no character is on the board.
  const cleanupBlocked = cleanupBlockers(characters, poses)
  const cleanupEmpty = !characters.some((ch) => characterOnBoard(ch, poses))
  const cleanupDisabled = cleanupEmpty || cleanupBlocked.length > 0
  const cleanupTitle = cleanupEmpty
    ? 'Cleanup Phase: no character is on the board.'
    : cleanupBlocked.length > 0
      ? `Each character on the board needs an Activated or Dazed token: ${cleanupBlocked.map((ch) => characterName(ch.key)).join(', ')}.`
      : 'Cleanup Phase for both players. Score VP first.'

  // Cleanup button in the toolbar (docs/features/round-phases.md): both sides at once, in one transaction.
  // It checks the blockers again at the click, and does nothing when blocked. Each write uses the updater
  // form, which reads the list now and runs inside set, so flipped and the round are filled after the
  // transaction. flipped lists the Dazed characters, also one that was already Injured.
  function handleCleanupPhase() {
    if (cleanupBlockers(characters, poses).length > 0 || cleanupEmpty) return
    const flipped = []
    let round = null
    // Priority passes when its holder activated last (p12). Read now, inside the transaction.
    const before = gamePriority(table.game.read(), table.setup.read())
    const after = priorityAfterCleanup(before, table.game.read().lastActivated)
    table.transact(() => {
      setCharacters((prev) =>
        prev.map((ch) => {
          if ((ch.tokens?.dazed ?? 0) > 0) flipped.push(characterName(ch.key))
          return cleanupCharacter(ch, CLEANUP_KEYS)
        }),
      )
      setLooseTokens((prev) => prev.filter((t) => !CLEANUP_KEYS.includes(t.key)))
      setTokens((prev) => cleanupCrisisTokens(prev, getCard))
      setScoreMarkers((prev) => {
        const spot = prev?.round ? nextRoundSpot(prev.round) : null
        if (!spot) return prev
        round = ROUND_POINTS.indexOf(spot) + 1
        return { ...prev, round: { x: spot.x, z: spot.z } }
      })
      if (after !== before) table.game.setField('priority', after)
      table.game.setField('lastActivated', null)
      writeLog('cleanup', { round, flipped, before, after })
    })
    const head =
      round === null
        ? 'Cleanup Phase: the round marker is not on the round track, so it did not move.'
        : `Cleanup Phase: round ${round}.`
    const note = priorityNote(before, after, nameCtx)
    const text = flipped.length > 0 ? `${head} Flipped: ${flipped.join(', ')}.` : head
    showHudMessage(note ? `${text} ${note}` : text, 8000)
  }

  // A click on the Priority marker gives Priority to the other side. Any player can click, also in a
  // multiplayer room, because cards change Priority.
  function handlePriorityClick() {
    if (!priority) return
    table.transact(() => {
      setPriorityField(otherTeam(priority))
      writeLog('priority', { side: otherTeam(priority) })
    })
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

  // The threat values that the game can still have, or all crisis threats when the rosters have none
  const breakdownThreats = useMemo(() => {
    const threats = possibleThreats(setup, parsedRosters, (code) => rosterCard(code)?.threat)
    return threats.length > 0 ? threats : CRISIS_THREATS
  }, [setup, parsedRosters])
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

  // The roll off is read when a new `throw` entry reaches the history, from this browser or the other one.
  // The shelf write and the entry are one transaction, so a browser that has the last entry has both full
  // shelves. Both browsers may write: the result is the same, and the write is skipped when it is already
  // there. Entries that were there at mount, or older than ROLL_OFF_FRESH ms (a history that syncs late),
  // are not new, so shelves left from before a restart do not count without a new throw.
  const seenThrows = useRef(null)
  useEffect(() => {
    const seen = seenThrows.current
    seenThrows.current = new Set(rolls.map((entry) => entry.id))
    if (!seen) return
    const fresh = rolls.some(
      (entry) =>
        entry.kind === 'throw' && !seen.has(entry.id) && Date.now() - entry.at < ROLL_OFF_FRESH,
    )
    if (!fresh) return
    const current = table.setup.read()
    if (setupStep(current) !== 'rollOff') return
    const dice = table.dice.read()
    const shelves = {}
    for (const team of TEAMS) {
      const onShelf = Object.values(dice[team]?.dice ?? {}).filter((die) => die.place === 'shelf')
      if (onShelf.length !== ROLL_OFF_DICE) return
      shelves[team] = onShelf.map((die) => FACES[die.face - 1]?.symbol)
    }
    const result = readRollOff(shelves)
    if (JSON.stringify(current.rollOff) === JSON.stringify(result)) return
    // The marker follows the winner. On a tie it stays as it is. Both browsers may write the entry, so its id
    // is fixed: the setup and the last throw.
    const lastThrow = rolls.findLast((entry) => entry.kind === 'throw')
    table.transact(() => {
      table.setup.set(setRollOff(current, result))
      if (result.winner) table.game.setField('priority', result.winner)
      const id = `rolloff:${current.id}:${lastThrow.id}`
      table.log.set((list) =>
        addEntry(list, logEntry('rollOff', mySide, { side: result.winner }, id)),
      )
    })
  }, [rolls, table, mySide])

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
    if (hiddenSquads && team !== mySide)
      return "This is the other player's roster, so you cannot choose its squad."
    if (placedSides(setup)[team]) return 'The squad is on the table.'
    if (setupStep(setup) !== 'squads') return 'You can choose a squad in the squad step.'
    if (viewOf(setup)) return 'You are browsing an earlier step.'
    if (setup.ready[team]) return 'Squad ready is on, so the squad does not change.'
    return null
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
      if (
        squad.characters.length === 0 ||
        squadThreat(parsedRosters[team], squad.characters) > setup.threat
      )
        return
    }
    table.transact(() => {
      setSetup((prev) => toggleReady(prev, team))
      writeLog('ready', { side: team, ready: !setup.ready[team] })
    })
  }

  // Token piles for new tactic cards ([{ id, key, team }] as in tacticCards): one pile per token of each card, in the order
  // of the cards, on the first free places beside the owner's tray. `card` links a pile to its card, so
  // the pile goes with it (removeCardPiles). Reads the document, not React state.
  function makeCardPiles(cards) {
    const piles = []
    for (const team of ['host', 'guest']) {
      const wanted = cards
        .filter((card) => card.team === team)
        .flatMap((card) =>
          (getTactic(card.key)?.tokens ?? []).map((key) => ({ card: card.id, key })),
        )
      const places = freePilePlaces(team, table.tokenPiles.read(), wanted.length)
      wanted.forEach((pile, i) =>
        piles.push({ id: crypto.randomUUID(), ...pile, x: places[i].x, z: places[i].z }),
      )
    }
    return piles
  }

  // The piles of tactic cards that leave the table go too. A pile without `card` stays.
  function removeCardPiles(cardIds) {
    setTokenPiles((prev) => prev.filter((p) => !cardIds.includes(p.card)))
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
        newCharacters.push(newCharacter(ch, side, { attached: parsed.characters[place].gems }))
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
    const parsed = parsedRosters[side]
    const choices = parsed ? squadAffiliationKeys(parsed, setup.squads[side].characters) : []
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

  // A click on a gem chip of a tray (TrayControls.jsx) or on an attached card in the tray popup: the card
  // face opens in the card popup. Reading changes nothing, so it works on any player's tray. The tray
  // popup closes, so only one popup is open. A card without an image shows what the app is missing.
  function handleAttachedOpen(code) {
    const info = rosterCard(code)
    if (!info?.image) {
      showHudMessage(`No card image for ${info?.name ?? code} (${code})`)
      return
    }
    setOpenTrayId(null)
    setOpenCard({ src: assetUrl(info.image), alt: info.name })
  }

  // Shows the card `step` places away in the open tab of the roster popup. The tab is a loop: after the
  // last card comes the first.
  function handleRosterCardStep(step) {
    setOpenRoster((prev) => {
      if (!prev || prev.tab === 'breakdown' || !rosters[prev.team]) return prev
      const count = rosterTabs(parseRosterText(rosters[prev.team].code))[prev.tab].length
      const index = (prev.index + step + count) % count
      return index === prev.index ? prev : { ...prev, index }
    })
  }

  // Delete key over a token on the table, as in TTS
  function handleLooseRemove(id) {
    setLooseTokens((prev) => prev.filter((t) => t.id !== id))
  }

  // pointerdown on a character token: a tray's Give source (a new token, the source never runs out),
  // or a token on the table (looseId).
  // giveId: the character of the tray, for a Give source: a click gives it one token (startTokenDrag).
  function handleTokenDragStart(e, tokenKey, looseId = null, giveId = null) {
    startTokenDrag(e, { tokenKey, looseId, giveId })
  }

  // pointerdown on a Library token chip. mode 'single': a new token, the same as from a Give
  // source. mode 'pile': a new pile (see docs/features/library.md, "Tokens").
  function handleLibraryTokenDragStart(e, tokenKey, mode) {
    startTokenDrag(e, { tokenKey, pile: mode === 'pile' })
  }

  // pointerdown on a pile on the table: a new token, the pile never runs out. With Shift, the drag
  // moves the pile.
  function handlePileTakeStart(e, pile) {
    startTokenDrag(e, { tokenKey: pile.key })
  }

  function handlePileMoveStart(e, pile) {
    startTokenDrag(e, { tokenKey: pile.key, pileId: pile.id })
  }

  // Delete key over a pile on the table
  function handlePileRemove(id) {
    setTokenPiles((prev) => prev.filter((p) => p.id !== id))
  }

  // A click on a tactic card in the Library: the card goes into the first free slot of the team's
  // tactic tray, or next to the tray when its 5 slots are full. It lies face up.
  function handleTacticSpawn(key, team) {
    const slot = firstFreeSlot(team, table.tactics.read())
    const card = { id: crypto.randomUUID(), key, team, x: slot.x, z: slot.z, up: 'face' }
    const newPiles = makeCardPiles([card])
    table.transact(() => {
      setTacticCards((prev) => [...prev, card])
      setTokenPiles((prev) => [...prev, ...newPiles])
    })
  }

  // The end of a tactic card drag at table point (x, z). Over the plate of a tactic tray, the card goes
  // into the nearest free slot of that tray and faces that tray's player, the same as a TTS snap point.
  // Otherwise it lies at the point. The card moves to the end of the list, so it lies on top.
  function handleTacticMove(id, x, z) {
    setTacticCards((prev) => {
      const card = prev.find((c) => c.id === id)
      if (!card) return prev
      const team = tacticTrayAt({ x, z })
      const slot = team && nearestFreeSlot(team, { x, z }, prev, id)
      const moved = slot ? { ...card, team, x: slot.x, z: slot.z } : { ...card, x, z }
      return [...prev.filter((c) => c.id !== id), moved]
    })
  }

  function handleTacticFlip(id) {
    setTacticCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, up: c.up === 'face' ? 'back' : 'face' } : c)),
    )
  }

  // Delete key over a tactic card
  function handleTacticRemove(id) {
    table.transact(() => {
      setTacticCards((prev) => prev.filter((c) => c.id !== id))
      removeCardPiles([id])
    })
  }

  // pointerdown on the supply pile of a Source card: a new supply token. The pile never runs out.
  function handleSupplyDragStart(e, cardKey) {
    const supply = getCard(cardKey)?.supply
    if (supply) startTokenDrag(e, { tokenKey: supply, supplyCard: cardKey })
  }

  // e is the DOM event. preventDefault stops the browser's own image drag and text selection. The
  // camera does not move during the drag (startPointerDrag). The drag becomes active after
  // DRAG_THRESHOLD px, and its release drops the token (handleTokenRelease). A release before that
  // is a click, which does nothing, except on a Give source (giveId). Escape cancels (see keyAction in keyboard.js). Any button starts it: the
  // Library chips never checked the button.
  // drag: tokenKey and the fields of tokenDrag that are set, the others get their defaults.
  function startTokenDrag(e, drag) {
    const base = {
      looseId: null,
      supplyCard: null,
      pile: false,
      pileId: null,
      giveId: null,
      ...drag,
    }
    // A new piece gets its id and key at the press, so the drag claims it like a piece on the table (decision 22)
    const newId = base.looseId || base.pileId ? null : crypto.randomUUID()
    const key = tokenDragKey(base, newId)
    const full = { ...base, newId, key }
    const spawn = newId ? { key, tokenKey: full.tokenKey } : null
    const handle = startPointerDrag(e, {
      key,
      ownership,
      live: pieceLives,
      // The point of TokenDragPreview
      livePose: () => dragPose(key, dragPointRef.current),
      controls: controlsRef.current,
      canvas: e.target,
      button: null,
      preventDefault: true,
      onStart: (ev) => {
        // After the claim, so the other player sees the key claimed when the spawn arrives
        if (spawn) ownership?.setSpawn(spawn)
        setTokenDrag(
          (prev) =>
            prev && { ...prev, active: true, start: { clientX: ev.clientX, clientY: ev.clientY } },
        )
      },
      onEnd: (ev) => {
        handleTokenRelease(ev.clientX, ev.clientY)
        endTokenDrag()
      },
      // A click on a Give source gives 1 token to the character of the tray, the same as a drop. The press
      // claimed nothing and set no spawn (onStart), so endTokenDrag only clears the state.
      onClick: () => {
        if (full.giveId) handleCharacterTokenGive(full.giveId, full.tokenKey)
        endTokenDrag()
      },
      onCancel: endTokenDrag,
      // The other player owns the piece: no drag, so the state set below must not stay
      onRefused: endTokenDrag,
    })
    if (!handle) return
    tokenDragHandleRef.current = handle
    tokenDragRef.current = full
    setTokenDrag({ ...full, active: false, start: null })
  }

  // The document write of a drop comes before this, and the release of the claim after it
  function endTokenDrag() {
    ownership?.setSpawn(null)
    tokenDragHandleRef.current = null
    tokenDragRef.current = null
    setTokenDrag(null)
  }

  function cancelTokenDrag() {
    tokenDragHandleRef.current?.cancel()
  }

  // Character under (clientX, clientY): the DOM tray controls first (data-character-id, see
  // TrayControls.jsx), then the 3D scene (Scene.jsx, characterAt). Usable outside a drag too: it is
  // passed down to Scene, which gives it to CrisisToken.jsx for an Extract token's release (Phase
  // 7), so a release over the tray's DOM controls strip counts, not only the model or the tray plate.
  function findCharacterAt(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY)?.closest('[data-character-id]')
    if (el) return el.dataset.characterId
    return characterAtRef.current?.(clientX, clientY) ?? null
  }

  // Release of an active token drag at (clientX, clientY). Over a HUD panel: nothing changes, so a
  // drag back onto the Library cancels it. Over a character (its model, or anywhere on its
  // tray): the character gets the token, the same as before. A table token is used up then, unless
  // the character is immune. Over the table or terrain: a new token lies there, or the dragged table
  // token moves there. Elsewhere (the space around the table): nothing changes. A supply token
  // follows the same rules, but it is a crisis token: a character holds it (handleSupplyTake). A
  // pile goes only on the table: a new pile lies there, or the moved pile moves there.
  function handleTokenRelease(clientX, clientY) {
    const { tokenKey, looseId, supplyCard, pile, pileId, newId } = tokenDragRef.current
    if (!document.elementFromPoint(clientX, clientY)?.closest('.scene-root')) return
    const characterId = findCharacterAt(clientX, clientY)
    if (pile || pileId) {
      const point = dragPointRef.current
      if (characterId || !point) return
      playSound('tokenPlace')
      if (pileId)
        setTokenPiles((prev) =>
          prev.map((p) => (p.id === pileId ? { ...p, x: point.x, z: point.z } : p)),
        )
      else setTokenPiles((prev) => [...prev, { id: newId, key: tokenKey, x: point.x, z: point.z }])
      return
    }
    if (supplyCard) {
      const point = dragPointRef.current
      const pile = supplyPilePosition(getCard(supplyCard).type)
      if (characterId) handleSupplyTake(supplyCard, pile.x, pile.z, characterId, newId)
      else if (point) {
        handleSupplyTake(supplyCard, point.x, point.z, null, newId)
        playSound('tokenPlace')
      }
      return
    }
    if (characterId) {
      table.transact(() => {
        if (handleCharacterTokenGive(characterId, tokenKey) && looseId) handleLooseRemove(looseId)
      })
      return
    }
    const point = dragPointRef.current
    if (!point) return
    playSound('tokenPlace')
    // A moved token goes to the end of the list, so it lies on top (tokens/stack.js)
    if (looseId)
      setLooseTokens((prev) => {
        const moved = prev.find((t) => t.id === looseId)
        if (!moved) return prev
        return [...prev.filter((t) => t.id !== looseId), { ...moved, x: point.x, z: point.z }]
      })
    else setLooseTokens((prev) => [...prev, { id: newId, key: tokenKey, x: point.x, z: point.z }])
  }

  const selectedTokenId = selectedId(selection, 'token')
  const selectedToken = tokens.find((t) => t.id === selectedTokenId) ?? null
  const openTray = openTrayId ? (characters.find((ch) => ch.id === openTrayId) ?? null) : null

  // The Breakdown tab of the open roster popup, only while the squad of that roster is not placed
  // (docs/features/squad-breakdown.md). Without it, a popup left on that tab shows the first tab with cards.
  let popupBreakdown = null
  let popupSquad = null
  let rosterPopupTab = openRoster?.tab
  if (openRoster && rosters[openRoster.team]) {
    const { team } = openRoster
    if (!placedSides(setup)[team]) {
      // A choice of another roster code counts as no choice. A threat that left the list shows the first
      // value; the filters stay (docs/features/squad-breakdown.md, "State").
      const stored = breakdownChoice[team]
      const choice = stored && stored.code === rosters[team].code ? stored : null
      const store = (change) =>
        setBreakdownChoice((prev) => {
          const prevChoice = prev[team]?.code === rosters[team].code ? prev[team] : null
          return {
            ...prev,
            [team]: {
              code: rosters[team].code,
              threat: prevChoice?.threat ?? breakdownThreats[0],
              filters: prevChoice?.filters ?? DEFAULT_FILTERS,
              ...change,
            },
          }
        })
      popupBreakdown = {
        threats: breakdownThreats,
        threat:
          choice && breakdownThreats.includes(choice.threat) ? choice.threat : breakdownThreats[0],
        filters: choice?.filters ?? DEFAULT_FILTERS,
        onThreatChange: (threat) => store({ threat }),
        onFiltersChange: (filters) => store({ filters }),
        // Whether a click chooses a squad, the reason when not, and the squad characters this browser may show
        chooseBlock: squadBlock(team),
        squadCharacters:
          hiddenSquads && team !== mySide
            ? []
            : (hiddenSquads ? ownSquad : setup.squads[team]).characters,
        onChoose: (places) => handleBreakdownChoose(team, places),
      }
      // The Add to squad button of the card tabs. Not while the squad is blocked (Ready, other roster).
      if (!squadBlock(team)) {
        const current = hiddenSquads ? ownSquad : setup.squads[team]
        popupSquad = {
          has: (tab, index) => current[tab]?.includes(index) ?? false,
          onToggle: (tab, index) => handleSquadToggle(team, tab, index),
        }
      }
    } else if (rosterPopupTab === 'breakdown') {
      const cards = rosterTabs(parsedRosters[team])
      rosterPopupTab = ROSTER_TABS.find((t) => cards[t.key].length > 0)?.key ?? 'characters'
    }
  }

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
  // The keys (keyboard.js, useTableKeys.js). The state is read at every key press. Last hook call: the
  // table of handlers uses what the hooks above give.
  const { heldPan, heldTurn, heldRotate } = useTableKeys({
    state: () => ({
      tokenDrag,
      toolDrag,
      popup: !!(openCard || openTrayId || openRoster || settingsOpen),
      rosterOpen: !!openRoster,
      diceMenu,
      libraryOpen,
      logOpen,
      diceTray: hoveredNow().diceTray,
    }),
    actions: {
      peek: (a) => altDown(a.blocked),
      cancelTokenDrag: () => cancelTokenDrag(),
      cancelToolDrag: () => toolDragHandleRef.current?.cancel(),
      closePopups: () => {
        setOpenCard(null)
        setOpenTrayId(null)
        setOpenRoster(null)
        setSettingsOpen(false)
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
      lift: () => liftPieceRef.current?.(),
      lock: () => handleLockKey(),
      ping: () => handlePingKey(),
      dice: (a) => addDiceRef.current[a.side]?.(a.count),
      range: (a) => handleToolKey('range', a.value),
      move: (a) => handleToolKey('move', a.value),
      angle: () => handleAngleKey(),
      clear: () => clearTools(),
    },
    turnPiece: (dir) => turnPieceRef.current?.(dir),
    altUp,
  })

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Holds the Canvas only: isolation: isolate (index.css) keeps every drei <Html> wrapper it
          mounts (terrain labels, the ruler tool, the tray controls) from ever drawing over the
          HUD below, no matter its z-index. See index.css, .scene-root. */}
      <div className="scene-root">
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
            if (e.type === 'click' && e.target instanceof HTMLCanvasElement) setSelection(NO_PIECES)
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
              mapId={mapId}
              tableButtons={{
                multiplayer: Boolean(room?.multiplayer),
                show: {
                  power: toolsOnTable('power'),
                  cleanup: toolsOnTable('cleanup'),
                  deployLock: toolsOnTable('deployLock'),
                  matTurn: toolsOnTable('matTurn'),
                },
                onPowerPhase: handlePowerPhase,
                onCleanupPhase: handleCleanupPhase,
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
                      onDragStart: startToolDrag,
                    }
                  : null
              }
              terrain={terrain}
              onTerrainHover={handleTerrainHover}
              terrainAtRef={terrainAtRef}
              characters={characters}
              tools={tools}
              ownSide={ownSide}
              onToolStore={handleToolStore}
              onToolReturn={rackShown ? handleToolReturn : undefined}
              ownership={ownership}
              presence={presence}
              ownPing={ownPing}
              live={live}
              pieceLives={pieceLives}
              angleSpawn={angleSpawn}
              toolSpawn={toolSpawn}
              showColliders={debug}
              showLabels={showLabels}
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
              toolPointRef={toolPointRef}
              onTokenMove={handleTokenMove}
              onTokenTurn={handleTokenTurn}
              onTokenHold={handleTokenHold}
              onHeldHover={handleHeldHover}
              onSupplyDragStart={handleSupplyDragStart}
              onCharacterDamage={handleCharacterDamage}
              onCharacterPower={handleCharacterPower}
              onCharacterFlip={handleCharacterFlip}
              onTrayCardHover={handleTrayCardHover}
              onCardHover={handleCardHover}
              onCharacterOffBoard={handleCharacterOffBoard}
              onCharacterTokenRemove={handleCharacterTokenRemove}
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
              characterAtRef={characterAtRef}
              findCharacterAt={findCharacterAt}
              modelPositionRef={modelPositionRef}
              turnPieceRef={turnPieceRef}
              liftPieceRef={liftPieceRef}
              returnModelsRef={returnModelsRef}
              playedSides={playedSides}
              removeWaits={removeWaits}
              onDiceTrayHover={handleDiceTrayHover}
              addDiceRef={addDiceRef}
              heldRotate={heldRotate}
              scoreMarkers={scoreMarkers}
              priority={priority}
              priorityTitle={priority ? priorityTitle(priority, nameCtx) : ''}
              onPriorityClick={handlePriorityClick}
              affiliations={affiliations}
              rosters={rosters}
              onRosterOpen={handleRosterOpen}
              setup={viewSetup}
              mySide={mySide}
              seatPlayers={seatPlayers}
              squadEdit={squadEdit}
              onSquadToggle={handleSquadToggle}
              setupActions={setupActions}
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
            maxPolarAngle={85 * (Math.PI / 180)}
            mouseButtons={CAMERA_MOUSE_BUTTONS}
          />
          <KeyboardCamera pan={heldPan} turn={heldTurn} />
          <WheelCamera ref={wheelCameraRef} />
          {debug && <FrameStats />}
          <Ready onReady={() => setReady(true)} />
        </Canvas>
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
          debug={debug}
          onDebugClick={() => setDebugOn((prev) => !prev)}
          showLabels={showLabels}
          onLabelsClick={() => setShowLabels((prev) => !prev)}
          spectator={spectator}
          onSpectatorClick={() => setSpectator((prev) => !prev)}
          onTurnMat={handleTurnMat}
          settings={settings}
          settingsOpen={settingsOpen}
          onSettingsClick={() => setSettingsOpen((prev) => !prev)}
          onPowerPhase={() => handlePowerPhase(playedSides)}
          onCleanupPhase={handleCleanupPhase}
          cleanupDisabled={cleanupDisabled}
          cleanupTitle={cleanupTitle}
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
        onSpawnCharacter={handleSpawn}
        onSpawnTactic={handleTacticSpawn}
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
      <CardPopup card={openCard} onClose={() => setOpenCard(null)} />
      {!(tokenDrag || toolDrag || openCard || openTrayId || openRoster || settingsOpen) && (
        <CardPopup card={peekCard} peek />
      )}
      {settingsOpen && (
        <SettingsPopup
          settings={settings}
          onChange={handleSettingChange}
          onVolumeChange={handleVolumeChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {openRoster && rosters[openRoster.team] && (
        <RosterPopup
          team={openRoster.team}
          code={rosters[openRoster.team].code}
          tab={rosterPopupTab}
          index={openRoster.index}
          breakdown={popupBreakdown}
          squad={popupSquad}
          onTabChange={(tab) => setOpenRoster((prev) => prev && { ...prev, tab, index: 0 })}
          onIndexChange={(index) =>
            setOpenRoster((prev) => (!prev || index === prev.index ? prev : { ...prev, index }))
          }
          onClose={() => setOpenRoster(null)}
        />
      )}
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
      <HudWarnings
        storageFailed={storageFailed}
        serverWarning={serverWarning}
        versionMismatch={versionMismatch}
        softwareRenderer={softwareRenderer}
        onSoftwareRendererClose={() => setSoftwareRenderer(null)}
      />
      {debug && <DebugPanel {...debugPanel} />}
      <LoadingOverlay ready={ready} />
    </div>
  )
}
