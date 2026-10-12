import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, events as pointerEvents } from '@react-three/fiber'
import { MOUSE } from 'three'
import { OrbitControls } from '@react-three/drei'
import { assetUrl } from './assets/index.js'
import Scene from './components/Scene.jsx'
import SelectionOutlines from './components/SelectionOutlines.jsx'
import { DEFAULT_LOOK, setLook } from './components/look.js'
import { COLOR_NAME, DEFAULT_SIDE_COLORS, setSideColors } from './sideColors.js'
import { Toolbar } from './components/Toolbar.jsx'
import { Library } from './components/Library.jsx'
import { LogPanel } from './components/LogPanel.jsx'
import { addEntry, addStatEntry, logEntry } from './log/log.js'
import { readLogOpen, writeLogOpen } from './log/open.js'
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
import { canFlip, canMove, getCard, hasArc, hasMarkers } from './crisis/cards.js'
import { supplyPilePosition } from './crisis/layout.js'
import {
  characterByCode,
  characterDropPlacer,
  characterImmune,
  characterIsGrunt,
  characterName,
  characterPowerBonus,
  characterStamina,
} from './characters/characters.js'
import { BASE_DIAMETER } from './characters/files.js'
import { trayHeldDefault } from './characters/trays.js'
import { characterOnBoard, modelCharacterId, secondModelId } from './characters/models.js'
import { powerAfterPhase } from './characters/power.js'
import { cleanupBlockers, cleanupCharacter } from './characters/cleanup.js'
import { cleanupCrisisTokens } from './crisis/cleanup.js'
import { DEFAULT_AFFILIATION, affiliationName, autoAffiliation } from './scoreboard/affiliations.js'
import { ROUND_POINTS, nextRoundSpot } from './scoreboard/board.js'
import { isSoftwareRenderer, rendererName } from './renderer.js'
import { CLEANUP_KEYS, getToken, isCappedToken } from './tokens/tokens.js'
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
import { dragPose, SUPPLY_YAW, tokenDragKey } from './net/livePose.js'
import { spawnEntry } from './components/storedTool.js'
import { canDropTool } from './tabletools/dropShape.js'
import { readSettings, writeSettings } from './settings/settings.js'
import { playSound, setVolume } from './sound.js'
import { panToPoint } from './camera.js'
import { playerName } from './setup/names.js'
import {
  modelsToReturn,
  placedToken,
  placerSide,
  waitGroups,
  waitText,
  waitingTokens,
} from './tokens/dropWait.js'
import HudNotice from './components/HudNotice.jsx'
import { useLogSounds } from './log/useLogSounds.js'
import { SettingsPopup } from './components/SettingsPopup.jsx'
import {
  NO_PIECES,
  NO_TOOLS,
  deselectPiece,
  isToolPiece,
  presenceSelection,
  presenceTools,
  selectPiece,
  selectedId,
  toolSelects,
} from './selection.js'
import {
  ANGLE_KEY,
  CARD_STEP_KEYS,
  CLEAR_TOOLS_KEY,
  DELETE_KEYS,
  DICE_KEYS,
  FLIP_KEY,
  LIFT_KEY,
  LOCK_KEY,
  MOVE_KEYS,
  PAN_KEYS,
  PING_KEY,
  RANGE_KEYS,
  RESET_VIEW_KEY,
  ROTATE_KEYS,
  TURN_KEYS,
  isEditing,
  useWindowKeys,
} from './keyboard.js'

// Start view, the seat of the host player. The host sits at +z (see
// characters/trays.js). The camera stands behind the host table edge and looks down at 45° at a
// point 16.8" from the mat center toward host, 46" away. Then a 16:10 view shows the whole mat, the
// tactic trays and the character trays of both players, and the rack band of the own side (z up to
// 36.8", see tabletools/layout.js). The bottom edge of the view meets the table at z = 37.5". The top
// edge is past the guest trays (z = -40, the table ends at -38). Space returns to this view (see
// resetCamera).
// Dice that each player rolls in the roll off
const ROLL_OFF_DICE = 5
// A throw entry older than this (ms) is not a new throw
const ROLL_OFF_FRESH = 30000

const CAMERA_TARGET = [0, 0, 16.8]
const CAMERA_POSITION = [0, 32.5, 49.3]
// The Red view: the Blue view turned 180° around the mat center (plan 08, decision 17). Only for the Red seat
// of a multiplayer room. A single player room and the Sandbox keep the Blue view, because one player plays both
// sides there.
const CAMERA_TARGET_GUEST = [0, 0, -16.8]
const CAMERA_POSITION_GUEST = [0, 32.5, -49.3]
// Camera mouse buttons as in TTS: right drag turns, middle drag pans. Left drag also turns, because
// the app has no box select (the TTS left drag) and a trackpad has no easy right drag. Shift, Ctrl
// or Cmd + a turn drag pans (OrbitControls). A mouse wheel zooms. On a trackpad, a two-finger swipe
// pans and a pinch zooms (WheelCamera.jsx).
const CAMERA_MOUSE_BUTTONS = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE }
const DEG = Math.PI / 180
// A crisis token is a 1" circle (CrisisToken.jsx, RADIUS). Drop places it just clear of the base.
const TOKEN_RADIUS = 0.5
const DROP_GAP = 0.1
// Several tokens dropped at once (handleDropCharacterTokens) are spread along a row next to the
// base, one TOKEN_RADIUS*2 (diameter) apart plus a gap, so they do not overlap.
const TOKEN_ROW_SPACING = TOKEN_RADIUS * 2 + DROP_GAP * 2
// A character token drag starts only after the pointer moves this many pixels, so a click on a
// Give source or a token on the table does not drop a token.
const EMPTY_SQUAD = { characters: [], tactics: [] }

// What a restart of the game setup removes, for its confirm (restartSetup)
const SETUP_REMOVAL =
  'The squads and the crisis cards that the game setup put on the table are removed.'

// Mat token entries of a card, as tracked in App state. Position and rotation come from cards.json
// (TTS x, z from the mat center, and TTS Y rotation), converted the same way as terrain: z -> -z.
// yaw: checked against the X-Men Infiltrate Secret Weapons Facility Zone map, see the report.
// The bottom edge of the map on the card is the side of the player with Priority (p9). cards.json has it
// at the host side. turned: the guest has Priority, so the map turns a half turn around the mat
// center (see docs/features/setup-game.md, "Priority").
function buildMatTokens(card, turned) {
  const marked = hasMarkers(card)
  const sign = turned ? -1 : 1
  return card.tokens.map((t) => ({
    id: crypto.randomUUID(),
    cardKey: card.key,
    frontKey: t.token,
    backKey: t.back ?? null,
    up: 'front',
    x: t.position[0] * sign,
    z: -t.position[1] * sign,
    yaw: Math.PI - (t.rotation ?? 180) * DEG + (turned ? Math.PI : 0),
    canMove: canMove(t),
    canFlip: canFlip(t),
    hasArc: hasArc(t),
    hasMarkers: marked,
    // Only Asset and Civilian can be held (p22); a Source stays on the mat and gives out its
    // supply instead (see supplyToken, docs/features/character-trays.md, "Hold and drop").
    canHold: card.type === 'extract' && canMove(t),
    heldBy: null, // character id, or null while the token sits on the mat
    heldAt: null, // tray-local [x, z] on the holder's card while held (see characters/trays.js)
    control: null,
    damage: false,
  }))
}

// A new supply token of a Source card, taken from its pile (see SupplyPile.jsx and
// handleSupplyTake). It lies on the table at (x, z), or a character holds it.
function supplyToken(card, x, z, id) {
  return {
    id,
    cardKey: card.key,
    frontKey: card.supply,
    backKey: null,
    up: 'front',
    x,
    z,
    yaw: SUPPLY_YAW,
    canMove: true,
    canFlip: false,
    hasArc: false,
    hasMarkers: false,
    canHold: true, // a Source's supply is the same Asset/Civilian token, see buildMatTokens above
    heldBy: null,
    heldAt: null,
    control: null,
    damage: false,
  }
}

// A new character on the table for `team`. ch: a row of CHARACTERS (characters/characters.js).
// attached: MCT codes of the cards attached to it (Infinity Gems from the roster). No field when empty.
function newCharacter(ch, team, { attached = [] } = {}) {
  return {
    id: crypto.randomUUID(),
    key: ch.slug,
    figure: ch.figure,
    base: ch.base,
    rotation: ch.rotation,
    // Second form, or null: a second model, and maybe a second card on the tray (see
    // characters/models.js and docs/features/character-trays.md, "Second forms").
    transform: ch.transform,
    team,
    // Card side that faces up, and the simple limits players apply by hand (see
    // docs/features/character-trays.md, "Players apply the rules").
    side: 'healthy',
    damage: 0,
    power: 0,
    // Token key (tokens.json) -> count, see handleCharacterTokenGive.
    tokens: {},
    ...(attached.length > 0 && { attached }),
  }
}

// R3F listens for pointer events on the element around the canvas. drei Html puts its HTML into that
// element too, so a click on an Html button (dice keys, game setup buttons) also reaches R3F. R3F aims its
// ray with offsetX and offsetY, which are relative to the button, not to the canvas. So the ray points near
// the top-left corner of the canvas, and an object there, for example a roster card, got the click. With
// this filter, an event that is not on the canvas hits no object. Drags are not changed, because they
// listen on window.
function canvasEvents(store) {
  return {
    ...pointerEvents(store),
    filter: (hits, state) =>
      state.internal.lastEvent.current?.target === state.gl.domElement ? hits : [],
  }
}

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
  const isGuest = Boolean(room?.multiplayer && room.side === 'guest')
  const cameraPosition = isGuest ? CAMERA_POSITION_GUEST : CAMERA_POSITION
  const cameraTarget = isGuest ? CAMERA_TARGET_GUEST : CAMERA_TARGET
  // The side of this browser. It writes the tools of that side only (net/doc.js, `tools`). The Sandbox and a
  // single player room are the host, because one player plays both sides there.
  const ownSide = isGuest ? 'guest' : 'host'
  // The sides this browser plays: its own in a multiplayer room, both in the Sandbox and a single player room
  const playedSides = room?.multiplayer ? [ownSide] : ['host', 'guest']
  const [tools] = useYRecord(table.tools)
  // The rest poses of the models, live: Scene applies a pose that the other browser wrote
  const [poses] = useYRecord(table.poses)
  const ownTools = tools[ownSide]
  // The toolbar state comes from the own entries: the range number, the movement type, and whether the
  // Toward / Away tool is on
  const activeRange = ownTools?.range?.which ?? null
  const activeMove = ownTools?.move?.which ?? null
  const angleOn = Boolean(ownTools?.angle)
  // Where the Toward / Away tool spawns: { target, aim }, the piece it snaps to and the piece it aims at,
  // each { kind, id } | null. Used once, at the spawn, in this browser only.
  const [angleSpawn, setAngleSpawn] = useState({ target: null, aim: null })
  // Where the range and movement tools spawn: { range, move }, the piece the tool snaps to, { kind, id } | null.
  // Set by a tool key over a piece, null for any other spawn (null: the tool snaps to the selected piece, as
  // before). Used once, at the spawn, in this browser only. Like angleSpawn.target, it also works over a model
  // that the key does not select (see handleToolKey).
  const [toolSpawn, setToolSpawn] = useState({ range: null, move: null })
  const [debugOn, setDebugOn] = useState(false)
  // 'full' | 'no-outline' | 'no-composer', see DebugPanel
  const [renderMode, setRenderMode] = useState('full')
  // Look options of cards and tokens, see DebugPanel and components/look.js
  const [toneMapping, setToneMapping] = useState(DEFAULT_LOOK.toneMapping)
  const [surface, setSurface] = useState(DEFAULT_LOOK.surface)
  const [showLabels, setShowLabels] = useState(true)
  // The spectator view above each model (SpectatorBadge.jsx)
  const [spectator, setSpectator] = useState(false)
  const [matTurns, setMatTurns] = useYField(table.game, 'matTurns')
  const [mapId, setMapId] = useYField(table.game, 'mapId')
  // The terrain pieces on the mat, see mapTerrain in rooms/table.js. A new map replaces them. The document
  // stores each piece's index in the map data and its lock. setTerrain writes only these.
  const [storedTerrain, setTerrain] = useYList(table.terrain)
  const terrain = useMemo(() => withPlacements(mapId, storedTerrain), [mapId, storedTerrain])
  // Id of the unlocked terrain piece under the pointer, for the Delete key
  const hoveredTerrainRef = useRef(null)
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
  // In a multiplayer room, the squad that the player chooses is not in the document until both players are
  // Ready. It is in this browser (rooms/store.js, squad): { setupId, squad } | null. A single player room
  // and the Sandbox keep the squads in the document. See docs/features/setup-game.md, "Squads".
  const hiddenSquads = Boolean(room?.multiplayer)
  const mySide = hiddenSquads ? room.side : null
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
  const [selection, setSelection] = useState(NO_PIECES)
  const [selectedTools, setSelectedTools] = useState(NO_TOOLS)
  // The other player sees the selection and the selected tools (decision 24)
  useEffect(() => {
    presence?.set({
      selection: presenceSelection(selection),
      tools: presenceTools(selectedTools),
    })
  }, [presence, selection, selectedTools])
  // The last ping of this browser, { id, at: [x, y, z], t } | null. Scene shows it (Ping.jsx).
  const [ownPing, setOwnPing] = useState(null)
  // Character or token under the pointer: { kind, id } | null. Only the tool keys read it, so it is a ref.
  const hoveredRef = useRef(null)
  // Pan and turn keys held down: key code → screen direction. KeyboardCamera moves the camera while one is held.
  const heldPan = useRef(new Map())
  const heldTurn = useRef(new Map())
  // Q / E held down: key code → direction. Scene turns the piece on while one is held (see turnPiece).
  const heldRotate = useRef(new Map())
  const controlsRef = useRef(null)
  const wheelCameraRef = useRef(null)
  // Scene fills it: { atPointer(), atCenter() }, table points for a free tool spawn (ToolPoint.jsx)
  const toolPointRef = useRef(null)
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
  // handleKeyDown).
  const [diceMenu, setDiceMenu] = useState(null)
  // The Library HUD panel (see Library.jsx), toggled by its toolbar button.
  const [libraryOpen, setLibraryOpen] = useState(false)
  // The Log panel (see LogPanel.jsx): expanded or collapsed, kept in this browser. The toolbar chip toggles it.
  const [logOpen, setLogOpenState] = useState(readLogOpen)
  function setLogOpen(open) {
    setLogOpenState(open)
    writeLogOpen(open)
  }
  const [rolls] = useYList(table.rolls)
  const [log] = useYList(table.log)

  // Adds a log entry (log/log.js). Call it in the same transaction as the change it tells. A fixed id is for
  // an effect that runs in both browsers: the same id makes one entry.
  function writeLog(kind, data, id) {
    table.log.set((list) => addEntry(list, logEntry(kind, mySide, data, id)))
  }
  // A Damage or Power entry, with the merge of clicks (addStatEntry). Same transaction rule as writeLog.
  function writeStatLog(ch, stat, from, to) {
    const data = { ...characterLogData(ch), stat, from, to }
    table.log.set((list) => addStatEntry(list, logEntry('stat', mySide, data)))
  }
  // The data that every character entry has: the side of the character gives the color of the entry
  function characterLogData(ch) {
    return { side: ch.team, characterId: ch.id, name: characterName(ch.key) }
  }
  // A short HUD message, for example an immunity block. Same pattern as the Library's own
  // message (a timeout clears it), but global: a drag can end over any tray.
  const [hudMessage, setHudMessage] = useState(null)
  const hudMessageTimer = useRef(null)
  // Name of the WebGL renderer when it runs on the CPU, see renderer.js. null: the graphics card draws, or
  // the player closed the warning.
  const [softwareRenderer, setSoftwareRenderer] = useState(null)
  // Character tokens that lie on the table: [{ id, key, x, z }]. A player drops them there from a
  // Give source, a pile or the Library, and drags them on to a character or another place. See
  // docs/features/character-trays.md, "Give tokens by drag and drop".
  const [looseTokens, setLooseTokens] = useYList(table.looseTokens)
  // Id of the table token under the pointer, for the Delete key. A ref, the same as hoveredRef.
  const hoveredLooseRef = useRef(null)
  // Piles of character tokens on the table, dropped from the Library in Pile mode: [{ id, key, x, z }].
  // A pile never runs out. See docs/features/library.md, "Pile".
  const [tokenPiles, setTokenPiles] = useYList(table.tokenPiles)
  // Id of the pile under the pointer, for the Delete key
  const hoveredPileRef = useRef(null)
  // Team Tactic cards on the table: [{ id, key, team, x, z, up }]. The order is the stack order: the
  // last card lies on top. See docs/features/team-tactic-cards.md, "State".
  const [tacticCards, setTacticCards] = useYList(table.tactics)
  // Id of the tactic card under the pointer, for the F and Delete keys
  const hoveredTacticRef = useRef(null)
  // Id of the crisis token under the pointer that a character holds, for the Delete key
  const hoveredHeldRef = useRef(null)
  // Id of the character whose tray card is under the pointer, for the F key
  const hoveredTrayCardRef = useRef(null)
  // The card image under the pointer, { src, alt, by } | null, for Alt. by: who reports it, so that the
  // end of an old hover does not clear a newer one (handleCardHover).
  const hoveredCardRef = useRef(null)
  // Alt is held down
  const altHeldRef = useRef(false)
  // The card image that shows large while Alt is held, or null (CardPopup.jsx, peek)
  const [peekCard, setPeekCard] = useState(null)
  // The side of the own dice tray under the pointer, or null, for the number keys
  const diceTrayHoveredRef = useRef(null)
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
  // A drag of a tool from the rack in progress: { kind, which, active, start } | null. active: the pointer has
  // moved DRAG_THRESHOLD px, so the outline of the tool shows (Scene.jsx, ToolDragGhost). start: the pointer
  // position at that moment. Like the token drag, the state changes only at start and when the drag becomes active.
  const [toolDrag, setToolDrag] = useState(null)
  // The drag code of the tool drag: { cancel }, or null
  const toolDragHandleRef = useRef(null)
  // The table point under the pointer, written by ToolDragGhost: { x, y, z } | null
  const toolDragPointRef = useRef(null)
  // The settings of this browser (settings/settings.js), read once. A change is stored at once.
  const [settings, setSettings] = useState(readSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  function handleSettingChange(item, place) {
    const next = { ...settings, tools: { ...settings.tools, [item]: place } }
    setSettings(next)
    writeSettings(next)
  }
  function handleVolumeChange(volume) {
    const next = { ...settings, sound: { volume } }
    setSettings(next)
    writeSettings(next)
  }
  useEffect(() => setVolume(settings.sound.volume / 100), [settings.sound.volume])
  // A token put on a character sounds in both browsers (log/useLogSounds.js)
  useLogSounds(log)
  // Dropped objective tokens that wait for their place (tokens/dropWait.js): one notice line for each character
  const waitLines = waitGroups(tokens).map((group) => {
    const ch = characters.find((c) => c.id === group.characterId)
    const mine = playedSides.includes(group.placeBy)
    const tokenNames = group.tokens.map((t) => getToken(t.frontKey)?.name ?? t.frontKey)
    const name = ch ? characterName(ch.key) : 'A character'
    const placer = playerName(group.placeBy, nameCtx)
    return {
      id: group.characterId ?? group.tokens[0].id,
      characterId: group.characterId,
      tokenId: group.tokens[0].id,
      ids: group.tokens.map((t) => t.id),
      mine,
      text: waitText({ mine, name, tokenNames, placer }),
    }
  })
  // Remove is off while a dropped token of the character waits, with the same text as its title
  const removeWaits = Object.fromEntries(waitLines.map((line) => [line.characterId, line.text]))
  // The notice sound, once for each new drop that this browser places. The tokens of an open table play nothing.
  const seenWaiting = useRef(null)
  const stopPan = useRef(null)
  const multiplayerRoom = Boolean(room?.multiplayer)
  useEffect(() => {
    const sides = multiplayerRoom ? [ownSide] : ['host', 'guest']
    const ids = new Set(
      waitingTokens(tokens)
        .filter((t) => sides.includes(t.placeBy))
        .map((t) => t.id),
    )
    const known = seenWaiting.current
    seenWaiting.current = ids
    if (!known) return
    const fresh = waitingTokens(tokens).filter((t) => ids.has(t.id) && !known.has(t.id))
    if (!fresh.length) return
    playSound('notice')
    // The Range 2 tool snaps to the model once per drop. Only the own tool can be written, so in the Sandbox
    // and a single player room it is the own tool also for a token of the other side.
    const characterId = fresh.find((t) => t.placeFrom?.characterId)?.placeFrom.characterId
    if (characterId) placeTool('range', 2, { kind: 'character', id: characterId }, null)
  }, [tokens, multiplayerRoom, ownSide])
  const toolsOnTable = (item) => settings.tools[item] === 'table'
  // The own rack is on the table, so a tool dropped on it goes back to it
  const rackShown = toolsOnTable('rack')
  // Live pose getters of the dragged pieces without a body, piece key → getter. Drag code fills it, LiveSync reads it.
  const [pieceLives] = useState(() => new Map())
  // Scene calls this with (clientX, clientY) and returns the character id under the point, or
  // null. See Scene.jsx, characterAt.
  const characterAtRef = useRef(null)
  // Scene calls this with a character id and returns its live table position { x, z } (Rapier body
  // or model object, not the spawn position), or null. Used by handleTokenDrop. See Scene.jsx, modelPosition.
  const modelPositionRef = useRef(null)
  // Scene calls this with a direction for Q / E: it turns the dragged character or tool, else the
  // one under the pointer. See Scene.jsx, turnPiece.
  const turnPieceRef = useRef(null)
  // Scene calls this for R: it lifts the character under the pointer or puts it back down. See
  // Scene.jsx, liftPiece.
  const liftPieceRef = useRef(null)
  // Scene's returnModels: puts the models of a character back on its tray
  const returnModelsRef = useRef(null)
  // The room could not use IndexedDB (storageFailed), and the player has not closed the warning yet
  const [storageWarning, setStorageWarning] = useState(storageFailed)
  // The server warning text that the player closed. A new text shows again.
  const [closedServerWarning, setClosedServerWarning] = useState(null)
  // The player closed the version warning (decision 14). It shows again after the next mismatch.
  const [versionClosed, setVersionClosed] = useState(false)
  const versionMismatch = Boolean(connection?.versionMismatch)
  if (!versionMismatch && versionClosed) setVersionClosed(false)
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

  function handleTerrainHover(id, over) {
    if (over) hoveredTerrainRef.current = id
    else if (hoveredTerrainRef.current === id) hoveredTerrainRef.current = null
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

  // The new character's tray goes at the end of its player's row, and the row recenters (see
  // trays.js, layoutTrays). A player has at most one copy of each character (slug): every spawn comes
  // here, so the check covers all of them. The two Sentinel MK4 sculpts have their own slugs, so a
  // player can have both. Both players can have the same character.
  function handleSpawn(ch) {
    if (characters.some((c) => c.key === ch.slug && c.team === ch.team)) {
      showHudMessage(
        `${COLOR_NAME[colorOf(ch.team, setup, Boolean(room))]} player already has ${ch.name} on the table`,
      )
      return
    }
    setCharacters((prev) => [...prev, newCharacter(ch, ch.team)])
  }

  // Spawn point of a tool turned on by the toolbar or by a key off the table: with a selected piece, null
  // (it snaps to the piece). Else the table point in the middle of the screen.
  function toolbarSpawnAt(snapPiece) {
    if (snapPiece) return null
    return toolPointRef.current?.atCenter() ?? { x: 0, z: 0 }
  }

  // Writes the own entry of a tool kind, or deletes it with null. Only the own side is written.
  function setOwnTool(kind, entry) {
    table.tools.setField(ownSide, (side) => {
      if (!entry && !side?.[kind]) return side
      const next = { ...side }
      if (entry) next[kind] = entry
      else delete next[kind]
      return next
    })
  }

  // A spawn: a new entry with a new id and no pose, so the tool mounts again in both browsers and an
  // old pose is gone. at: { x, z } for a free spawn, null to snap to a piece.
  function spawnTool(kind, which, at) {
    setOwnTool(kind, spawnEntry(which, at))
  }

  // A tool of the own side rested (Tool in RulerTool.jsx). Only the entry of that spawn takes it, so
  // a tool that was replaced meanwhile writes nothing.
  function handleToolStore(kind, spawn, fields) {
    table.tools.setField(ownSide, (side) => {
      const entry = side?.[kind]
      return entry?.spawn === spawn ? { ...side, [kind]: { ...entry, ...fields } } : side
    })
  }

  function handleRangeClick(range) {
    setToolSpawn((prev) => ({ ...prev, range: null }))
    if (activeRange === range) setOwnTool('range', null)
    else spawnTool('range', range, toolbarSpawnAt(selection.findLast(isToolPiece)))
  }

  function handleMoveClick(move) {
    setToolSpawn((prev) => ({ ...prev, move: null }))
    if (activeMove === move) setOwnTool('move', null)
    else spawnTool('move', move, toolbarSpawnAt(selection.findLast(isToolPiece)))
  }

  // The toolbar button: the tool spawns at the selected character, aimed at the selected token
  function handleAngleClick() {
    const target = selection.find((p) => p.kind === 'character') ?? null
    setAngleSpawn({
      target,
      aim: selection.find((p) => p.kind === 'token') ?? null,
    })
    if (angleOn) setOwnTool('angle', null)
    else spawnTool('angle', true, toolbarSpawnAt(target))
  }

  // over: true when the pointer moved onto the piece, false when it moved off
  function handlePieceHover(piece, over) {
    if (over) hoveredRef.current = piece
    else if (hoveredRef.current?.kind === piece.kind && hoveredRef.current.id === piece.id)
      hoveredRef.current = null
  }

  // over: the pointer moved onto (true) or off (false) a card or a model. While Alt is held, the shown card follows.
  function handleCardHover(card, over) {
    if (over) hoveredCardRef.current = card
    else if (hoveredCardRef.current?.by === card.by) hoveredCardRef.current = null
    if (altHeldRef.current) setPeekCard(hoveredCardRef.current)
  }

  // Every key press of the app is handled here, so that the same key can do different things in
  // different states. The states now: a card or tray popup is open, or the table is in use.
  // The keys are in keyboard.js.
  function handleKeyDown(e) {
    if (e.key === 'Alt') {
      // Windows moves the focus to the browser menu on a bare Alt
      e.preventDefault()
      altHeldRef.current = true
      if (!(tokenDrag || toolDrag || openCard || openTrayId || openRoster || settingsOpen))
        setPeekCard(hoveredCardRef.current)
      return
    }
    if (tokenDrag) {
      // Escape cancels the drag. Other keys do nothing while a token is under the pointer.
      if (e.key === 'Escape') cancelTokenDrag()
      return
    }
    if (toolDrag) {
      // The same for a tool dragged from the rack
      if (e.key === 'Escape') toolDragHandleRef.current?.cancel()
      return
    }
    if (openCard || openTrayId || openRoster || settingsOpen) {
      // Escape closes only the popup. The left and right arrows show the previous or next roster card.
      // Other keys do nothing, so nothing changes on the table behind it.
      if (e.key === 'Escape') {
        setOpenCard(null)
        setOpenTrayId(null)
        setOpenRoster(null)
        setSettingsOpen(false)
      } else if (openRoster && CARD_STEP_KEYS[e.code]) handleRosterCardStep(CARD_STEP_KEYS[e.code])
      return
    }
    if (e.key === 'Escape') {
      // A dice tray die menu closes first, then the Library, before the table's own Escape behavior.
      if (diceMenu) {
        setDiceMenu(null)
        return
      }
      if (libraryOpen) {
        setLibraryOpen(false)
        return
      }
      if (logOpen) {
        setLogOpen(false)
        return
      }
      handleEscape()
      return
    }
    if (e.metaKey || e.ctrlKey || e.altKey || isEditing(e.target)) return
    if (DELETE_KEYS.includes(e.key)) {
      if (hoveredLooseRef.current) handleLooseRemove(hoveredLooseRef.current)
      else if (hoveredHeldRef.current) handleHeldRemove(hoveredHeldRef.current)
      else if (hoveredPileRef.current) handlePileRemove(hoveredPileRef.current)
      else if (hoveredTacticRef.current) handleTacticRemove(hoveredTacticRef.current)
      else if (hoveredTerrainRef.current) handleTerrainRemove(hoveredTerrainRef.current)
      else if (hoveredTrayCardRef.current) handleTrayCardDelete(hoveredTrayCardRef.current)
      return
    }
    if (PAN_KEYS[e.code]) {
      heldPan.current.set(e.code, PAN_KEYS[e.code])
      return
    }
    if (TURN_KEYS[e.code]) {
      heldTurn.current.set(e.code, TURN_KEYS[e.code])
      return
    }
    if (e.code === RESET_VIEW_KEY) {
      // Space also presses the focused button, for example the last clicked toolbar button
      e.preventDefault()
      if (!e.repeat) resetCamera()
      return
    }
    if (ROTATE_KEYS[e.code]) {
      heldRotate.current.set(e.code, ROTATE_KEYS[e.code])
      // Scene turns the piece on while the key is held, at the same speed on every computer. So
      // the key repeat of the system does not turn it.
      if (!e.repeat) turnPieceRef.current?.(ROTATE_KEYS[e.code])
      return
    }
    if (e.repeat) return
    if (e.code === FLIP_KEY) {
      handleFlipKey()
      return
    }
    if (e.code === LIFT_KEY) {
      liftPieceRef.current?.()
      return
    }
    if (e.code === LOCK_KEY) {
      handleLockKey()
      return
    }
    if (e.code === PING_KEY) {
      handlePingKey()
      return
    }
    // Over an own dice tray, the number keys clear the tray, then add dice, not tools. Over the other tray they spawn tools.
    if (DICE_KEYS[e.key] && diceTrayHoveredRef.current) {
      addDiceRef.current[diceTrayHoveredRef.current]?.(DICE_KEYS[e.key])
      return
    }
    if (RANGE_KEYS[e.key]) handleToolKey('range', RANGE_KEYS[e.key])
    else if (MOVE_KEYS[e.key]) handleToolKey('move', MOVE_KEYS[e.key])
    else if (e.key === ANGLE_KEY) handleAngleKey()
    else if (e.key === CLEAR_TOOLS_KEY) clearTools()
  }

  function handleKeyUp(e) {
    if (e.key === 'Alt') {
      altHeldRef.current = false
      setPeekCard(null)
    }
    heldPan.current.delete(e.code)
    heldTurn.current.delete(e.code)
    heldRotate.current.delete(e.code)
  }

  // A key released outside the window sends no keyup
  function handleBlur() {
    altHeldRef.current = false
    setPeekCard(null)
    heldPan.current.clear()
    heldTurn.current.clear()
    heldRotate.current.clear()
  }

  useWindowKeys(handleKeyDown, handleKeyUp, handleBlur)

  // Moves the camera back to the start view at once
  function resetCamera() {
    const controls = controlsRef.current
    if (!controls) return
    // A zoom or pan of the wheel that is not done yet would move the camera away from the start view
    wheelCameraRef.current?.stop()
    controls.object.position.set(...cameraPosition)
    controls.target.set(...cameraTarget)
    controls.update()
  }

  // Escape clears every selection: the character, the token and the tools. The selected tools are
  // also removed from the table.
  function handleEscape() {
    if (selectedTools.range) setOwnTool('range', null)
    if (selectedTools.move) setOwnTool('move', null)
    if (selectedTools.angle) setOwnTool('angle', null)
    setSelectedTools(NO_TOOLS)
    setSelection(NO_PIECES)
  }

  // Key 0: removes every tool from the table. The selected pieces stay selected.
  function clearTools() {
    table.tools.setField(ownSide, {})
    setSelectedTools(NO_TOOLS)
  }

  // Over a model of a side this browser does not play (the other side in a multiplayer room), a tool key
  // snaps the tool to it but does not select it. Else Place could move that model.
  function keySelects(piece) {
    return toolSelects(piece, characters, playedSides)
  }

  // Key P: a ping at the table point under the pointer, none when the pointer is off the table. It shows
  // here at once, and in the other browser through presence (docs/features/ping.md).
  function handlePingKey() {
    const point = toolPointRef.current?.atPointer()
    if (!point) return
    const next = { id: crypto.randomUUID(), at: [point.x, point.y, point.z], t: Date.now() }
    setOwnPing(next)
    presence?.set({ ping: next })
  }

  // Key 6, the Toward / Away tool: placeAngleTool at the hovered piece and the table point under the pointer.
  function handleAngleKey() {
    placeAngleTool(hoveredRef.current, toolPointRef.current?.atPointer())
  }

  // The tool keys 1 to 5 and 7 to 9: placeTool at the hovered piece and the table point under the pointer.
  // tool: 'range' | 'move'. value: the range number or the movement tool type.
  function handleToolKey(tool, value) {
    placeTool(tool, value, hoveredRef.current, toolPointRef.current?.atPointer())
  }

  // The Toward / Away tool at a piece or a table point (key 6, and the drop of a drag from the rack). Over a
  // character or a token (piece), it selects that piece and spawns the tool again snapped to it, even if
  // the tool is already out. It aims at the character or token selected last that is not that piece, or at the
  // mat center. Over the table or terrain (at: { x, z }), it spawns the tool free at that point, also if it is
  // already out. With neither, it toggles the tool, the same as its toolbar button.
  function placeAngleTool(piece, at) {
    if (!piece) {
      if (!at) {
        handleAngleClick()
        return
      }
      setAngleSpawn({ target: null, aim: null })
      spawnTool('angle', true, at)
      return
    }
    setAngleSpawn({
      target: piece,
      aim:
        selection.findLast(
          (p) => isToolPiece(p) && !(p.kind === piece.kind && p.id === piece.id),
        ) ?? null,
    })
    if (keySelects(piece)) setSelection((prev) => selectPiece(prev, piece))
    spawnTool('angle', true, null)
  }

  // A range or movement tool at a piece or a table point (the tool keys, and the drop of a drag from the rack).
  // tool: 'range' | 'move'. value: the range number or the movement tool type.
  // Over a character or a token (piece), it selects that piece and spawns the tool again, snapped to it, even
  // if the tool is already out. A selected piece of the other kind stays selected. Over the table or terrain
  // (at: { x, z }), it spawns the tool free at that point, also if it is already out. With neither, it toggles
  // the tool, the same as its toolbar button.
  function placeTool(tool, value, piece, at) {
    if (!piece) {
      if (!at) {
        if (tool === 'range') handleRangeClick(value)
        else handleMoveClick(value)
        return
      }
      setToolSpawn((prev) => ({ ...prev, [tool]: null }))
      spawnTool(tool, value, at)
      return
    }
    setToolSpawn((prev) => ({ ...prev, [tool]: piece }))
    if (keySelects(piece)) setSelection((prev) => selectPiece(prev, piece))
    spawnTool(tool, value, null)
  }

  // F, as in TTS: flips the crisis token under the pointer (also one that a character holds), the
  // card of the character under the pointer (its model or its tray card), or the tactic card under
  // the pointer. With nothing under the pointer, it flips the token or character selected last (the
  // card of a character). A token without a back does not flip (handleTokenFlip).
  function handleFlipKey() {
    const piece =
      hoveredRef.current ??
      (hoveredHeldRef.current && { kind: 'token', id: hoveredHeldRef.current }) ??
      (hoveredTrayCardRef.current && { kind: 'character', id: hoveredTrayCardRef.current }) ??
      (hoveredTacticRef.current && { kind: 'tactic', id: hoveredTacticRef.current }) ??
      selection.findLast(isToolPiece)
    if (piece?.kind === 'token') handleTokenFlip(piece.id)
    // A character piece is a model; a second model has its own id (characters/models.js)
    else if (piece?.kind === 'character') handleCharacterFlip(modelCharacterId(piece.id))
    else if (piece?.kind === 'tactic') handleTacticFlip(piece.id)
  }

  // type: 'secure' | 'extract'. key: a card key, or null for "None". The old card takes its tokens with it,
  // also the supply tokens that players took from its pile. The new card's tokens turn with the Priority
  // of the game setup (buildMatTokens).
  function handleCrisisChange(type, key) {
    const oldKey = crisis[type]
    table.transact(() => {
      setCrisis((prev) => ({ ...prev, [type]: key }))
      setTokens((prev) => {
        const kept = prev.filter((t) => t.cardKey !== oldKey)
        const card = getCard(key)
        return card ? [...kept, ...buildMatTokens(card, priorityOf(setup) === 'guest')] : kept
      })
    })
    // The selected token may no longer exist; a selected character is not affected.
    setSelection((prev) => prev.filter((p) => p.kind !== 'token'))
  }

  // A held token dragged off its tray card and released on the table is no longer held.
  function handleTokenMove(id, x, z) {
    // A dropped token that waits for its place is placed where it is released
    if (table.tokens.read().find((t) => t.id === id)?.placeBy) {
      placeTokens([id], { [id]: { x, z } })
      return
    }
    const token = tokens.find((t) => t.id === id)
    table.transact(() => {
      setTokens((prev) =>
        prev.map((t) => (t.id === id ? { ...t, x, z, heldBy: null, heldAt: null } : t)),
      )
      if (token?.heldBy)
        writeHeldLog(
          characters.find((ch) => ch.id === token.heldBy),
          token,
          false,
        )
    })
  }

  function handleTokenTurn(id, yaw) {
    setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, yaw } : t)))
  }

  function handleTokenFlip(id) {
    setTokens((prev) =>
      prev.map((t) =>
        t.id === id && t.canFlip ? { ...t, up: t.up === 'front' ? 'back' : 'front' } : t,
      ),
    )
  }

  function handleTokenControl(id, control) {
    setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, control } : t)))
  }

  function handleTokenDamage(id, damage) {
    setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, damage } : t)))
  }

  // A canHold token is released over a character (CrisisToken.jsx reports it, Scene.jsx finds the
  // character with characterAt): that character now holds it. The token leaves the mat (Scene.jsx
  // keeps heldBy tokens out of the tool snap list) and lies on its holder's tray card, on the
  // character art (trays.js, trayHeldDefault). No range check (see docs/features/crisis.md, "Players
  // apply the rules"). cardPoint: the tray-local [x, z] on the character's card when the release
  // point is on its tray, otherwise null. It is used only to move a token on its own holder's card:
  // a token given to a character always goes to the default place.
  function handleTokenHold(id, characterId, cardPoint) {
    const held = tokens.find((t) => t.id === id)
    table.transact(() => {
      setTokens((prev) => {
        const token = prev.find((t) => t.id === id)
        if (!token) return prev
        if (token.heldBy === characterId) {
          return cardPoint ? prev.map((t) => (t.id === id ? { ...t, heldAt: cardPoint } : t)) : prev
        }
        const heldCount = prev.filter((t) => t.heldBy === characterId).length
        return prev.map((t) =>
          t.id === id ? { ...t, heldBy: characterId, heldAt: trayHeldDefault(heldCount) } : t,
        )
      })
      // A move on its own holder's card is no entry
      if (held && held.heldBy !== characterId)
        writeHeldLog(
          characters.find((ch) => ch.id === characterId),
          held,
          true,
        )
    })
  }

  // A new supply token from the pile of a Source card (handleTokenRelease), with the id of the drag. Released over a
  // character: that character holds it, at the default place on its card, the same as
  // handleTokenHold. Otherwise it lies on the table at (x, z).
  function handleSupplyTake(cardKey, x, z, characterId, id) {
    const card = getCard(cardKey)
    if (!card?.supply) return
    table.transact(() => {
      setTokens((prev) => {
        const token = supplyToken(card, x, z, id)
        if (!characterId) return [...prev, token]
        const heldCount = prev.filter((t) => t.heldBy === characterId).length
        return [...prev, { ...token, heldBy: characterId, heldAt: trayHeldDefault(heldCount) }]
      })
      if (characterId)
        writeHeldLog(
          characters.find((ch) => ch.id === characterId),
          supplyToken(card, x, z, id),
          true,
        )
    })
  }

  // over: the pointer moved onto (true) or off (false) a crisis token that a character holds
  function handleHeldHover(id, over) {
    if (over) hoveredHeldRef.current = id
    else if (hoveredHeldRef.current === id) hoveredHeldRef.current = null
  }

  // over: the pointer moved onto (true) or off (false) the tray card of a character
  function handleTrayCardHover(id, over) {
    if (over) hoveredTrayCardRef.current = id
    else if (hoveredTrayCardRef.current === id) hoveredTrayCardRef.current = null
  }

  // Delete key over a token on a character's card, as in TTS. Players remove a Source's supply
  // tokens in the Cleanup Phase, and the pile gives new ones. The hover can outlive the hold (a
  // drag off the card ends on the table before the pointer leaves the token), so only a token that
  // is still held is removed.
  function handleHeldRemove(id) {
    if (!tokens.find((t) => t.id === id)?.heldBy) return
    setTokens((prev) => prev.filter((t) => t.id !== id))
    setSelection((prev) => deselectPiece(prev, { kind: 'token', id }))
  }

  // Drop, when its holder is removed: the token goes back on the table, next to the base of the
  // model that held it (the live Rapier/object position, not the spawn position, so a moved
  // character drops it where it stands). rowOffset moves it along the base's edge (+z of the +x drop
  // direction), so several tokens dropped together (handleDropCharacterTokens) land in a row
  // instead of stacked on each other. If the holder's position is not available (see Scene.jsx,
  // modelPosition), the token stays where it last sat on the mat. During the game, a player drops a
  // token by dragging it from the card to the table (handleTokenMove).
  // wait: { placeBy, offBoard } or null. The token then waits for its place: only the side placeBy places it, and
  // placeFrom keeps the base it dropped from (tokens/dropWait.js).
  function handleTokenDrop(id, rowOffset, wait = null) {
    setTokens((prev) => {
      const token = prev.find((t) => t.id === id)
      if (!token?.heldBy) return prev
      const holder = characters.find((ch) => ch.id === token.heldBy)
      const pos = modelPositionRef.current?.(token.heldBy)
      const baseRadius = holder ? BASE_DIAMETER[holder.base] / 2 : 0
      const x = (pos?.x ?? token.x) + baseRadius + TOKEN_RADIUS + DROP_GAP
      const z = (pos?.z ?? token.z) + rowOffset
      const dropped = { ...token, heldBy: null, heldAt: null, x, z }
      if (wait) {
        dropped.placeBy = wait.placeBy
        dropped.placeFrom = {
          characterId: token.heldBy,
          x: pos?.x ?? token.x,
          z: pos?.z ?? token.z,
          radius: baseRadius,
          offBoard: wait.offBoard,
        }
      }
      return prev.map((t) => (t.id === id ? dropped : t))
    })
  }

  // Remove calls this for a character it is about to remove, so the character drops every token it
  // holds first (see docs/features/character-trays.md, "Hold and drop"). Several tokens spread along a row
  // next to the base (TOKEN_ROW_SPACING apart) instead of landing on the same spot.
  // wait: { placeBy, offBoard } or null (Dazed and Remove, decision of the plan "game flow"): the tokens then wait
  // for their place and the log tells it. Call it inside a transaction. A character that already has a Remove
  // wait keeps it for the new tokens too, so its models go back when the last one is placed.
  function handleDropCharacterTokens(characterId, wait = null) {
    const held = tokens.filter((t) => t.heldBy === characterId)
    const holder = characters.find((ch) => ch.id === characterId)
    const offBoard =
      Boolean(wait?.offBoard) ||
      tokens.some(
        (t) => t.placeBy && t.placeFrom?.characterId === characterId && t.placeFrom.offBoard,
      )
    const mark = wait && { placeBy: wait.placeBy, offBoard }
    held.forEach((t, i) => {
      const rowOffset = (i - (held.length - 1) / 2) * TOKEN_ROW_SPACING
      handleTokenDrop(t.id, rowOffset, mark)
      if (mark && holder)
        writeLog('dropped', {
          ...characterLogData(holder),
          tokenId: t.id,
          tokenName: getToken(t.frontKey)?.name ?? t.frontKey,
          placeBy: mark.placeBy,
        })
    })
  }

  // The side that places what `ch` drops: its opponent, or its controlling player (characters/dropPlacer.js)
  function dropWait(ch, offBoard) {
    return {
      placeBy: placerSide(ch.team, characterDropPlacer(ch.key, ch.side)),
      offBoard,
    }
  }

  // The waiting tokens `ids` are placed: at the points (id → { x, z }) or where they lie (a click on Done). A token
  // that is not waiting is skipped, so a second call does nothing. Only the browser that clears the last waiting
  // token of a character that had Remove puts its models back, as Remove did before the wait.
  function placeTokens(ids, points = {}) {
    const current = table.tokens.read()
    const waiting = current.filter((t) => ids.includes(t.id) && t.placeBy)
    if (waiting.length === 0) return
    const back = modelsToReturn(current, ids)
    table.transact(() => {
      setTokens((prev) =>
        prev.map((t) =>
          ids.includes(t.id) && t.placeBy ? placedToken(t, points[t.id] ?? null) : t,
        ),
      )
      for (const t of waiting) {
        const ch = characters.find((c) => c.id === t.placeFrom?.characterId)
        if (ch)
          writeLog('placed', {
            ...characterLogData(ch),
            side: t.placeBy,
            tokenId: t.id,
            tokenName: getToken(t.frontKey)?.name ?? t.frontKey,
            placeBy: t.placeBy,
          })
      }
    })
    back.forEach((id) => returnModelsRef.current?.(id))
  }

  // Show in the notice: the camera target moves to the first waiting token of the character, smooth
  function handleNoticeShow(line) {
    const token = tokens.find((t) => t.id === line.tokenId)
    const controls = controlsRef.current
    if (!token || !controls) return
    wheelCameraRef.current?.stop()
    stopPan.current?.()
    stopPan.current = panToPoint(controls, { x: token.x, y: 0, z: token.z })
  }

  // Data of a 'token' entry (log/log.js). key: the token key ('activated' is the one that Step 4 gives its own
  // sound), count: how many the character has after the change.
  function tokenEntryData(ch, key, on, count) {
    return {
      ...characterLogData(ch),
      key,
      tokenName: getToken(key)?.name ?? key,
      on,
      count,
    }
  }

  // An objective token that a character holds, or drops from its card (a 'held' entry). `token`: the entry of
  // `tokens` (its name comes from the front token), ch: the character.
  function writeHeldLog(ch, token, on) {
    if (!ch) return
    const tokenName = getToken(token.frontKey)?.name ?? token.frontKey
    writeLog('held', { ...characterLogData(ch), tokenId: token.id, tokenName, on })
  }

  // Damage never goes below 0 or above the Stamina of the side that faces up (p16).
  function handleCharacterDamage(id, damage) {
    const target = table.characters.read().find((ch) => ch.id === id)
    if (!target) return
    const to = Math.max(0, Math.min(damage, characterStamina(target.key, target.side)))
    table.transact(() => {
      setCharacters((prev) => prev.map((ch) => (ch.id === id ? { ...ch, damage: to } : ch)))
      writeStatLog(target, 'damage', target.damage ?? 0, to)
    })
  }

  // Power never goes below 0 or above 10 (p7-8).
  function handleCharacterPower(id, power) {
    const target = table.characters.read().find((ch) => ch.id === id)
    if (!target) return
    const to = Math.max(0, Math.min(power, 10))
    table.transact(() => {
      setCharacters((prev) => prev.map((ch) => (ch.id === id ? { ...ch, power: to } : ch)))
      writeStatLog(target, 'power', target.power ?? 0, to)
    })
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

  // Flip turns the card to the other side and clears Damage, the same as in TTS.
  function handleCharacterFlip(id) {
    const target = table.characters.read().find((ch) => ch.id === id)
    if (!target) return
    const to = target.side === 'healthy' ? 'injured' : 'healthy'
    table.transact(() => {
      setCharacters((prev) =>
        prev.map((ch) => (ch.id === id ? { ...ch, side: to, damage: 0 } : ch)),
      )
      writeLog('flip', { ...characterLogData(target), to })
    })
  }

  // Remove button on the tray: the character leaves the board (a KO'd character, p16). Its held tokens
  // drop next to the model first (the live position), then each model goes back on its card (Scene.jsx,
  // returnModels). The character, its tray, tokens, Damage and Power stay. The selection stays too:
  // the models are still there.
  // With held tokens, the models stay until the tokens are placed (placeTokens). Remove waits then.
  function handleCharacterOffBoard(id) {
    const target = characters.find((ch) => ch.id === id)
    if (removeWaits[id]) return
    const holds = Boolean(target) && tokens.some((t) => t.heldBy === id)
    table.transact(() => {
      if (target) writeLog('offBoard', characterLogData(target))
      handleDropCharacterTokens(id, holds ? dropWait(target, true) : null)
    })
    if (!holds) returnModelsRef.current?.(id)
  }

  // Delete key over a tray card. The confirm names the character, because it takes the tray with it.
  function handleTrayCardDelete(id) {
    const ch = characters.find((c) => c.id === id)
    if (!ch) return
    if (window.confirm(`Remove ${characterName(ch.key)} from the table? Its tray is removed too.`))
      handleCharacterRemove(id)
  }

  // Delete key over a tray card (handleTrayCardDelete) removes a character. Drops every token
  // the character holds first (p10), then removes the character: its model and its tray both come
  // from the same characters array (Scene.jsx), so one state update removes all three. The poses of
  // its models go too. Also clears a selection or popup that still points at it, so nothing keeps the
  // id or its Rapier body after the model unmounts.
  function handleCharacterRemove(id) {
    const target = characters.find((ch) => ch.id === id)
    table.transact(() => {
      if (target) writeLog('deleted', characterLogData(target))
      handleDropCharacterTokens(id)
      setCharacters((prev) => prev.filter((ch) => ch.id !== id))
      table.poses.set(({ [id]: _first, [secondModelId(id)]: _second, ...rest }) => rest)
    })
    setSelection((prev) =>
      deselectPiece(deselectPiece(prev, { kind: 'character', id }), {
        kind: 'character',
        id: secondModelId(id),
      }),
    )
    setOpenTrayId((prev) => (prev === id ? null : prev))
  }

  // A short message in the HUD, for a few seconds (the immunity block below; the Library has its
  // own copy of this pattern for the "no 3D model" message).
  function showHudMessage(text, ms = 3000) {
    clearTimeout(hudMessageTimer.current)
    setHudMessage(text)
    hudMessageTimer.current = setTimeout(() => setHudMessage(null), ms)
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

  // Gives one of tokenKey to a character. A character cannot get a condition it is immune to
  // (p21): the drop does nothing, the HUD shows why, and the result is false. Conditions, Activated
  // and Dazed stay at 1 at most (p17); every other token counts up (see docs/features/character-trays.md,
  // "Players apply the rules"). The result is true then, also for a token at its limit: the
  // dropped token is used up, as in TTS, where the tray deletes it.
  function handleCharacterTokenGive(id, tokenKey) {
    const target = characters.find((ch) => ch.id === id)
    if (target && characterImmune(target.key, target.side).includes(tokenKey)) {
      showHudMessage(
        `${characterName(target.key)} is immune to ${getToken(tokenKey)?.name ?? tokenKey}.`,
      )
      return false
    }
    // The Activated token also records the side of the character, for the Cleanup Phase (priority.js)
    table.transact(() => {
      setCharacters((prev) =>
        prev.map((ch) => {
          if (ch.id !== id) return ch
          const count = ch.tokens[tokenKey] ?? 0
          if (isCappedToken(tokenKey) && count >= 1) return ch
          return { ...ch, tokens: { ...ch.tokens, [tokenKey]: count + 1 } }
        }),
      )
      if (tokenKey === 'activated' && target) table.game.setField('lastActivated', target.team)
      // A capped token that is already there changes nothing, so it has no entry
      const had = target?.tokens[tokenKey] ?? 0
      if (target && !(isCappedToken(tokenKey) && had >= 1))
        writeLog('token', tokenEntryData(target, tokenKey, true, had + 1))
      // A new Dazed token makes the character drop its objective tokens (p10)
      if (tokenKey === 'dazed' && target && had === 0)
        handleDropCharacterTokens(id, dropWait(target, false))
    })
    return true
  }

  // A click on a token in the tray's "On" row removes one.
  function handleCharacterTokenRemove(id, tokenKey) {
    const target = characters.find((ch) => ch.id === id)
    table.transact(() => {
      setCharacters((prev) =>
        prev.map((ch) => {
          if (ch.id !== id) return ch
          const count = (ch.tokens[tokenKey] ?? 0) - 1
          const tokens = { ...ch.tokens }
          if (count > 0) tokens[tokenKey] = count
          else delete tokens[tokenKey]
          return { ...ch, tokens }
        }),
      )
      const had = target?.tokens[tokenKey] ?? 0
      if (target && had > 0) writeLog('token', tokenEntryData(target, tokenKey, false, had - 1))
    })
  }

  // over: the pointer moved onto (true) or off (false) a table token. A token that is removed or
  // dragged unmounts, which also ends its hover (see TokenFace.jsx).
  function handleLooseHover(id, over) {
    if (over) hoveredLooseRef.current = id
    else if (hoveredLooseRef.current === id) hoveredLooseRef.current = null
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

  function handlePileHover(id, over) {
    if (over) hoveredPileRef.current = id
    else if (hoveredPileRef.current === id) hoveredPileRef.current = null
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

  function handleTacticHover(id, over) {
    if (over) hoveredTacticRef.current = id
    else if (hoveredTacticRef.current === id) hoveredTacticRef.current = null
  }

  // pointerdown on the supply pile of a Source card: a new supply token. The pile never runs out.
  function handleSupplyDragStart(e, cardKey) {
    const supply = getCard(cardKey)?.supply
    if (supply) startTokenDrag(e, { tokenKey: supply, supplyCard: cardKey })
  }

  // e is the DOM event. preventDefault stops the browser's own image drag and text selection. The
  // camera does not move during the drag (startPointerDrag). The drag becomes active after
  // DRAG_THRESHOLD px, and its release drops the token (handleTokenRelease). A release before that
  // is a click, which does nothing, except on a Give source (giveId). Escape cancels (see handleKeyDown). Any button starts it: the
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

  // A press on an own tool or chip of the rack (ToolRack.jsx). e is the pointer event of the 3D scene or the DOM
  // event of a chip. kind: 'range' | 'move' | 'angle'. which: the range number, the movement type, or true. The
  // camera does not move during the press (startPointerDrag). After DRAG_THRESHOLD px, the outline of the tool
  // follows the pointer, and the release drops the tool (handleToolDrop). onClick: the release of a press
  // that did not become a drag (chips only; a tool of the 3D scene has its own click). Escape cancels (see
  // handleKeyDown).
  function startToolDrag(e, kind, which, onClick) {
    const drag = { kind, which }
    const handle = startPointerDrag(e, {
      controls: controlsRef.current,
      canvas: e.nativeEvent?.target ?? e.target,
      preventDefault: true,
      onStart: (ev) =>
        setToolDrag(
          (prev) =>
            prev && { ...prev, active: true, start: { clientX: ev.clientX, clientY: ev.clientY } },
        ),
      onEnd: (ev) => {
        handleToolDrop(drag, ev.clientX, ev.clientY)
        endToolDrag()
      },
      onClick: () => {
        endToolDrag()
        onClick?.()
      },
      onCancel: endToolDrag,
    })
    if (!handle) return
    toolDragHandleRef.current = handle
    setToolDrag({ ...drag, active: false, start: null })
  }

  function endToolDrag() {
    toolDragHandleRef.current = null
    setToolDrag(null)
  }

  // The release of a tool drag at (clientX, clientY): the same as the tool key at that point. Over the piece
  // under the pointer, the tool snaps to it. Over the table or terrain, it spawns free there. Over a HUD
  // panel, off the table or over the own rack: nothing, and no toggle (docs/features/table-tools.md, "Tool
  // rack"). The piece under the pointer is hoveredRef: the drag releases the pointer capture of the canvas,
  // so the hover events of the 3D scene go on during the drag.
  function handleToolDrop({ kind, which }, clientX, clientY) {
    if (!document.elementFromPoint(clientX, clientY)?.closest('.scene-root')) return
    const point = toolDragPointRef.current
    if (!canDropTool(ownSide, point)) return
    const at = { x: point.x, z: point.z }
    if (kind === 'angle') placeAngleTool(hoveredRef.current, at)
    else placeTool(kind, which, hoveredRef.current, at)
  }

  // A move drag of an own tool ended on the own rack: the tool goes back to it (Scene.jsx, onToolReturn)
  function handleToolReturn(kind) {
    setOwnTool(kind, null)
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
      else if (point) handleSupplyTake(supplyCard, point.x, point.z, null, newId)
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
  useEffect(() => {
    setLook(debug ? { toneMapping, surface } : DEFAULT_LOOK)
  }, [debug, toneMapping, surface])
  const mode = debug ? renderMode : 'full'

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
              onDiceTrayHover={(side, over) => {
                if (over) diceTrayHoveredRef.current = side
                else if (diceTrayHoveredRef.current === side) diceTrayHoveredRef.current = null
              }}
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
      <div className="hud-warnings">
        {storageWarning && (
          <div className="hud-warning" role="alert">
            <span>
              Room not saved: browser storage is not available. Changes on this table are lost when
              the page closes.
            </span>
            <button type="button" className="chip" onClick={() => setStorageWarning(false)}>
              Close
            </button>
          </div>
        )}
        {serverWarning && serverWarning !== closedServerWarning && (
          <div className="hud-warning" role="alert">
            <span>{serverWarning}</span>
            <button
              type="button"
              className="chip"
              onClick={() => setClosedServerWarning(serverWarning)}
            >
              Close
            </button>
          </div>
        )}
        {versionMismatch && !versionClosed && (
          <div className="hud-warning" role="alert">
            <span>
              Your opponent uses a different version of the app. Both players should reload the
              page.
            </span>
            <button type="button" className="chip" onClick={() => setVersionClosed(true)}>
              Close
            </button>
          </div>
        )}
        {softwareRenderer && (
          <div className="hud-warning" role="alert" title={softwareRenderer}>
            <span>
              The browser draws the 3D view without the graphics card (software rendering), so the
              app is slow. Turn on hardware acceleration in the browser settings.
            </span>
            <button type="button" className="chip" onClick={() => setSoftwareRenderer(null)}>
              Close
            </button>
          </div>
        )}
      </div>
      {debug && (
        <DebugPanel
          renderMode={renderMode}
          onRenderModeChange={setRenderMode}
          toneMapping={toneMapping}
          onToneMappingChange={setToneMapping}
          surface={surface}
          onSurfaceChange={setSurface}
        />
      )}
      <LoadingOverlay ready={ready} />
    </div>
  )
}
