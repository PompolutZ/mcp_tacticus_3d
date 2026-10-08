import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, events as pointerEvents } from '@react-three/fiber'
import { MOUSE } from 'three'
import { OrbitControls } from '@react-three/drei'
import Scene from './components/Scene.jsx'
import SelectionOutlines from './components/SelectionOutlines.jsx'
import { Toolbar } from './components/Toolbar.jsx'
import { Library } from './components/Library.jsx'
import { KeyboardCamera } from './components/KeyboardCamera.jsx'
import { WheelCamera } from './components/WheelCamera.jsx'
import { LoadingOverlay } from './components/LoadingOverlay.jsx'
import { Preload, Ready } from './components/Preload.jsx'
import { TokenPanel } from './components/TokenPanel.jsx'
import { CardPopup } from './components/CardPopup.jsx'
import { TrayPopup } from './components/TrayPopup.jsx'
import { RosterPopup } from './components/RosterPopup.jsx'
import { canFlip, canMove, getCard, hasArc, hasMarkers } from './crisis/cards.js'
import { supplyPilePosition } from './crisis/layout.js'
import { characterByCode, characterImmune, characterName, characterStamina } from './characters/characters.js'
import { BASE_DIAMETER } from './characters/files.js'
import { trayHeldDefault } from './characters/trays.js'
import { characterModels, modelCharacterId, secondModelId } from './characters/models.js'
import { isSoftwareRenderer, rendererName } from './renderer.js'
import { getToken, isCappedToken } from './tokens/tokens.js'
import { firstFreeSlot, nearestFreeSlot, tacticTrayAt } from './tactics/layout.js'
import { formatMctCode, isEmptyRoster } from './rosters/mct.js'
import { parseRosterText, rosterCard, rosterTabs, squadThreat, unknownCodesMessage } from './rosters/cards.js'
import { CRISIS_TYPES, NEW_SETUP, TEAMS, activateSquads, chooseDeck, chooseEdge, chooseThreat, otherTeam, otherType, pickCard, setupPlacedCards, setupStep, toggleReady, toggleSquadCard } from './setup/setup.js'
import FrameStats from './debug/FrameStats.jsx'
import { DebugPanel } from './debug/DebugPanel.jsx'
import { TERRAIN_PIECES } from './terrain/pieces.js'
import { mapTerrain, savedTable, startTable } from './rooms/table.js'
import { tableFiles } from './rooms/preload.js'
import { saveRoom } from './rooms/store.js'
import { NO_PIECES, NO_TOOLS, deselectPiece, isToolPiece, selectPiece, selectedId } from './selection.js'
import { ANGLE_KEY, CARD_STEP_KEYS, CLEAR_TOOLS_KEY, DELETE_KEYS, DICE_KEYS, FLIP_KEY, LIFT_KEY, LOCK_KEY, MOVE_KEYS, PAN_KEYS, RANGE_KEYS, RESET_VIEW_KEY, ROTATE_KEYS, TURN_KEYS, isEditing, useWindowKeys } from './keyboard.js'

// Start view, the seat of the blue player. For now every player is Blue. Blue sits at +z (see
// characters/trays.js). The camera stands behind the blue table edge and looks down at 45° at a
// point 10.4" from the mat center toward blue, 46" away. Then a 16:10 view shows the whole mat, the
// tactic trays and the character trays of both players. The bottom edge of the view meets the table
// at z = 31.1", just past the blue Give sources (30.65", see trays.js). Space returns to this view
// (see resetCamera).
const CAMERA_TARGET = [0, 0, 10.4]
const CAMERA_POSITION = [0, 32.5, 42.9]
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
const DRAG_THRESHOLD = 4
// The map on the mat when the Sandbox starts, a key in MAPS
const START_MAP = 'vibranium-heist'
// What a restart of the game setup removes, for its confirm (restartSetup)
const SETUP_REMOVAL = 'The squads and the crisis cards that the game setup put on the table are removed.'
// A room saves its table this often (ms), when something changed. See docs/feature-rooms.md, "When the
// room saves".
const SAVE_INTERVAL = 2000

// Mat token entries of a card, as tracked in App state. Position and rotation come from cards.json
// (TTS x, z from the mat center, and TTS Y rotation), converted the same way as terrain: z -> -z.
// yaw: checked against the X-Men Infiltrate Secret Weapons Facility Zone map, see the report.
// The bottom edge of the map on the card is the side of the player with Priority (p9). cards.json has it
// at the blue side. turned: the red player has Priority, so the map turns a half turn around the mat
// center (see docs/feature-setup-game.md, "Priority").
function buildMatTokens(card, turned) {
  const marked = hasMarkers(card)
  const sign = turned ? -1 : 1
  return card.tokens.map(t => ({
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
    // supply instead (see supplyToken, docs/characters-hud.md, "Hold and drop").
    canHold: card.type === 'extract' && canMove(t),
    heldBy: null, // character id, or null while the token sits on the mat
    heldAt: null, // tray-local [x, z] on the holder's card while held (see characters/trays.js)
    control: null,
    damage: false,
  }))
}

// A new supply token of a Source card, taken from its pile (see SupplyPile.jsx and
// handleSupplyTake). It lies on the table at (x, z), or a character holds it.
function supplyToken(card, x, z) {
  return {
    id: crypto.randomUUID(),
    cardKey: card.key,
    frontKey: card.supply,
    backKey: null,
    up: 'front',
    x,
    z,
    yaw: 0,
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

// A new character on the table for `teamColor`. ch: a row of CHARACTERS (characters/characters.js).
function newCharacter(ch, teamColor) {
  return {
    id: crypto.randomUUID(),
    key: ch.slug,
    figure: ch.figure,
    base: ch.base,
    rotation: ch.rotation,
    // Second form, or null: a second model, and maybe a second card on the tray (see
    // characters/models.js and docs/characters-hud.md, "Second forms").
    transform: ch.transform,
    teamColor,
    // Card side that faces up, and the simple limits players apply by hand (see
    // docs/characters-hud.md, "Players apply the rules").
    side: 'healthy',
    damage: 0,
    power: 0,
    // Token key (tokens.json) -> count, see handleCharacterTokenGive.
    tokens: {},
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
    filter: (hits, state) => (state.internal.lastEvent.current?.target === state.gl.domElement ? hits : []),
  }
}

// One table: a room, or the Sandbox. Root.jsx mounts a new App for each, so nothing stays from the last
// table. room: the room record (rooms/store.js), or null for the Sandbox. A room starts with its saved
// table and saves it (saveTable). Its map is fixed, and its rosters come from the room. The Sandbox
// starts empty and is not saved. onExit(): opens the lobby. See docs/feature-rooms.md.
export default function App({ room = null, onExit }) {
  // The state of the table at the start (rooms/table.js): the saved table of the room, or a new one
  const [start] = useState(() => startTable(room?.mapId ?? START_MAP, room?.table ?? null))
  const [activeRange, setActiveRange] = useState(null)
  const [activeMove, setActiveMove] = useState(null)
  // The Toward / Away tool is on the table, and where it spawns: { target, aim }, the piece it snaps to
  // and the piece it aims at, each { kind, id } | null
  const [angleOn, setAngleOn] = useState(false)
  const [angleSpawn, setAngleSpawn] = useState({ target: null, aim: null })
  const [debugOn, setDebugOn] = useState(false)
  // 'full' | 'no-outline' | 'no-composer', see DebugPanel
  const [renderMode, setRenderMode] = useState('full')
  const [showLabels, setShowLabels] = useState(false)
  // The spectator view above each model (SpectatorBadge.jsx)
  const [spectator, setSpectator] = useState(false)
  const [matTurns, setMatTurns] = useState(start.matTurns)
  const [mapId, setMapId] = useState(room?.mapId ?? START_MAP)
  // The terrain pieces on the mat, see mapTerrain in rooms/table.js. A new map replaces them.
  const [terrain, setTerrain] = useState(start.terrain)
  // Id of the unlocked terrain piece under the pointer, for the Delete key
  const hoveredTerrainRef = useRef(null)
  // Scene calls this and returns the id of the terrain piece under the pointer, locked or not, or
  // null. See Scene.jsx, terrainAt.
  const terrainAtRef = useRef(null)
  const [deployLine, setDeployLine] = useState(start.deployLine)
  const [characters, setCharacters] = useState(start.characters)
  // The chosen Secure and Extract card, by key. null = none.
  const [crisis, setCrisis] = useState(start.crisis)
  // Every crisis token on the table: the mat tokens of the cards (buildMatTokens) and the supply
  // tokens that players took from a pile (supplyToken).
  const [tokens, setTokens] = useState(start.tokens)
  // Scoring board markers: { blue, red, round } → { x, z } on the table (see ScoreBoard.jsx)
  const [scoreMarkers, setScoreMarkers] = useState(start.scoreMarkers)
  // Loaded rosters: { blue, red } → null | { code }, code in Jarvis format (see rosters/mct.js). A room
  // brings its rosters: Blue, and Red when the room has it.
  const [rosters, setRosters] = useState(room?.rosters ?? { blue: null, red: null })
  // The game setup: crisis cards, threat, deployment edge and squads (setup/setup.js, GameSetup.jsx). A new
  // roster starts it again.
  const [setup, setSetup] = useState(start.setup)
  // The players whose clicks on their roster cards choose the squad: { blue, red } → true. Off, a click opens
  // the roster popup. Not saved.
  const [squadSelect, setSquadSelect] = useState({ blue: false, red: false })
  // Affiliation token that each player's VP marker shows: { blue, red } → key in scoreboard/affiliations.json.
  // No toolbar control: Setup game sets it (see docs/feature-setup-game.md).
  const [affiliations, setAffiliations] = useState(start.affiliations)
  // Selected pieces and tools, see selection.js. One character, one token, the range tool, the
  // movement tool and the Toward / Away tool can all be selected at the same time.
  const [selection, setSelection] = useState(NO_PIECES)
  const [selectedTools, setSelectedTools] = useState(NO_TOOLS)
  // Character or token under the pointer: { kind, id } | null. Only the tool keys read it, so it is a ref.
  const hoveredRef = useRef(null)
  // Pan and turn keys held down: key code → screen direction. KeyboardCamera moves the camera while one is held.
  const heldPan = useRef(new Map())
  const heldTurn = useRef(new Map())
  // Q / E held down: key code → direction. Scene turns the piece on while one is held (see turnPiece).
  const heldRotate = useRef(new Map())
  const controlsRef = useRef(null)
  const wheelCameraRef = useRef(null)
  // Count of tool key presses over a piece, per tool: { range, move, angle }. See Scene.
  const [toolSpawns, setToolSpawns] = useState({ range: 0, move: 0, angle: 0 })
  // Crisis card image open in the full-screen popup: { src, alt } | null, see CardPopup.jsx.
  const [openCard, setOpenCard] = useState(null)
  // Id of the character whose whole tray is open in the full-screen popup, or null (see
  // TrayPopup.jsx). At most one of openCard, openTrayId and openRoster is set: each popup covers the table.
  const [openTrayId, setOpenTrayId] = useState(null)
  // Roster open in the full-screen popup, see RosterPopup.jsx: { team, tab, index } | null. tab: a key
  // of ROSTER_TABS (rosters/cards.js), index: the card shown in that tab.
  const [openRoster, setOpenRoster] = useState(null)
  // The open "Reroll one / Change one to" menu of a dice tray face plate, at most one across both
  // trays: { trayKey, symbol } | null. Lifted here, not into DiceKeys, so Escape can close it (see
  // handleKeyDown).
  const [diceMenu, setDiceMenu] = useState(null)
  // The Library HUD panel (see Library.jsx), toggled by its toolbar button.
  const [libraryOpen, setLibraryOpen] = useState(false)
  // A short HUD message, for example an immunity block. Same pattern as the Library's own
  // message (a timeout clears it), but global: a drag can end over any tray.
  const [hudMessage, setHudMessage] = useState(null)
  const hudMessageTimer = useRef(null)
  // Name of the WebGL renderer when it runs on the CPU, see renderer.js. null: the graphics card draws, or
  // the player closed the warning.
  const [softwareRenderer, setSoftwareRenderer] = useState(null)
  // Character tokens that lie on the table: [{ id, key, x, z }]. A player drops them there from a
  // Give source, a pile or the Library, and drags them on to a character or another place. See
  // docs/characters-hud.md, "Give tokens by drag and drop".
  const [looseTokens, setLooseTokens] = useState(start.looseTokens)
  // Id of the table token under the pointer, for the Delete key. A ref, the same as hoveredRef.
  const hoveredLooseRef = useRef(null)
  // Piles of character tokens on the table, dropped from the Library in Pile mode: [{ id, key, x, z }].
  // A pile never runs out. See docs/feature-library.md, "Pile".
  const [tokenPiles, setTokenPiles] = useState(start.tokenPiles)
  // Id of the pile under the pointer, for the Delete key
  const hoveredPileRef = useRef(null)
  // Team Tactic cards on the table: [{ id, key, team, x, z, up }]. The order is the stack order: the
  // last card lies on top. See docs/feature-team-tactic-cards.md, "State".
  const [tacticCards, setTacticCards] = useState(start.tacticCards)
  // Id of the tactic card under the pointer, for the F and Delete keys
  const hoveredTacticRef = useRef(null)
  // Id of the crisis token under the pointer that a character holds, for the Delete key
  const hoveredHeldRef = useRef(null)
  // Id of the character whose tray card is under the pointer, for the F key
  const hoveredTrayCardRef = useRef(null)
  // True while the pointer is over the player's dice tray, for the number keys
  const diceTrayHoveredRef = useRef(false)
  // The player's dice tray fills it with its addDice: adds that many dice. See DiceTray.jsx.
  const addDiceRef = useRef(null)
  // A token drag in progress: { tokenKey, looseId, supplyCard, pile, pileId, active, start } | null.
  // looseId: the table token that is dragged, or null for a new token from a source. supplyCard: the
  // card key when the new token comes from the supply pile of a Source card (tokenKey is then a
  // crisis token key), otherwise null. pile: the drag brings a new pile from the Library. pileId: the
  // drag moves that pile (Shift + drag). active: the pointer has moved DRAG_THRESHOLD px, so the dragged token
  // shows under the pointer (Scene.jsx, TokenDragPreview). start: the pointer position at that
  // moment. The state changes only at start and when the drag becomes active, not on every
  // pointermove.
  const [tokenDrag, setTokenDrag] = useState(null)
  // The same drag, plus the pointerdown position, for the window listeners below
  const tokenDragRef = useRef(null)
  // The table point under the pointer, written by TokenDragPreview: { x, y, z } | null
  const dragPointRef = useRef(null)
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
  // Scene calls this and returns the pose of every model on the table, for the room save. See
  // Scene.jsx, modelPoses.
  const modelPosesRef = useRef(null)
  // The poses of the last save. A model whose body is not mounted at a save keeps its pose from here.
  const lastPoses = useRef(start.poses)
  // The last save failed, so the next failure shows no message again
  const saveFailed = useRef(false)
  // The files to load before the table shows: the map and the models (rooms/preload.js). Read once.
  const [preloadFiles] = useState(() => tableFiles({ mapId, terrain: start.terrain, characters: start.characters, rosters }))
  // The scene and the preloaded files are in, so the loading screen hides (Preload.jsx, Ready)
  const [ready, setReady] = useState(false)

  // Stores the table of the room (docs/feature-rooms.md, "Storage"). The bodies may be gone, for example
  // when the table unmounts. Then each model keeps the pose of the last save.
  function saveTable() {
    let live = {}
    try {
      live = modelPosesRef.current?.() ?? {}
    } catch {
      // The physics world is gone
    }
    const poses = {}
    for (const { id } of characters.flatMap(characterModels)) {
      const pose = live[id] ?? lastPoses.current[id]
      if (pose) poses[id] = pose
    }
    lastPoses.current = poses
    const table = savedTable({ matTurns, deployLine, terrain, characters, crisis, tokens, scoreMarkers, affiliations, setup, looseTokens, tokenPiles, tacticCards, poses })
    const saved = saveRoom(room, rosters, table)
    if (!saved && !saveFailed.current) showHudMessage('Room not saved: browser storage is full')
    saveFailed.current = !saved
  }

  // The timer and the listeners below call the saveTable of the last render, which sees the last state
  const saveTableRef = useRef(saveTable)
  saveTableRef.current = saveTable

  // A room saves every SAVE_INTERVAL, when the page closes or reloads, and when the table unmounts (the
  // back button). A model move changes no React state, so a timer, not the state, starts the save.
  // saveRoom writes only a change.
  useEffect(() => {
    if (!room) return undefined
    const save = () => saveTableRef.current()
    const timer = setInterval(save, SAVE_INTERVAL)
    window.addEventListener('pagehide', save)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pagehide', save)
      save()
    }
  }, [room])

  // ← Lobby in the toolbar. A room saves first. The Sandbox is not saved, so it asks first.
  function handleLobby() {
    if (room) saveTable()
    else if (!window.confirm('Leave the Sandbox? Its table is not saved.')) return
    onExit()
  }

  // direction: 1 turns the mat 90° counter-clockwise, -1 clockwise
  function handleTurnMat(direction) {
    setMatTurns(prev => (prev + direction + 4) % 4)
  }

  // A new map brings its own terrain, all locked. The selected terrain piece is gone.
  function handleMapChange(id) {
    setMapId(id)
    setTerrain(mapTerrain(id))
    setSelection(prev => prev.filter(p => p.kind !== 'terrain'))
  }

  // L, as in TTS: locks or unlocks the terrain piece under the pointer. A piece that gets locked is
  // deselected. A locked piece looks the same as an unlocked one, so the HUD message shows the new state.
  function handleLockKey() {
    const id = terrainAtRef.current?.()
    const piece = id && terrain.find(p => p.id === id)
    if (!piece) return
    const locked = !piece.locked
    setTerrain(prev => prev.map(p => p.id === id ? { ...p, locked } : p))
    if (locked) setSelection(prev => deselectPiece(prev, { kind: 'terrain', id }))
    showHudMessage(`${TERRAIN_PIECES[piece.piece].name} ${locked ? 'locked' : 'unlocked'}`)
  }

  function handleTerrainHover(id, over) {
    if (over) hoveredTerrainRef.current = id
    else if (hoveredTerrainRef.current === id) hoveredTerrainRef.current = null
  }

  // Delete key over an unlocked terrain piece. A locked piece gets no hover (Terrain.jsx), so it
  // cannot be removed. Models on the piece fall: Rapier wakes the bodies that touched its collider.
  function handleTerrainRemove(id) {
    setTerrain(prev => prev.filter(p => p.id !== id))
    setSelection(prev => deselectPiece(prev, { kind: 'terrain', id }))
  }

  // Toggles the "Reroll one / Change one to" menu for one face plate. Opening one closes any other.
  function handleDiceMenuToggle(trayKey, symbol) {
    setDiceMenu(prev => (prev?.trayKey === trayKey && prev.symbol === symbol) ? null : { trayKey, symbol })
  }

  function handleDiceMenuClose() {
    setDiceMenu(null)
  }

  // The new character's tray goes at the end of its player's row, and the row recenters (see
  // trays.js, layoutTrays). A player has at most one copy of each character (slug): every spawn comes
  // here, so the check covers all of them. The two Sentinel MK4 sculpts have their own slugs, so a
  // player can have both. Both players can have the same character.
  function handleSpawn(ch) {
    if (characters.some(c => c.key === ch.slug && c.teamColor === ch.teamColor)) {
      showHudMessage(`${ch.teamColor === 'blue' ? 'Blue' : 'Red'} player already has ${ch.name} on the table`)
      return
    }
    setCharacters(prev => [...prev, newCharacter(ch, ch.teamColor)])
  }

  function handleRangeClick(range) {
    setActiveRange(prev => prev === range ? null : range)
  }

  function handleMoveClick(move) {
    setActiveMove(prev => prev === move ? null : move)
  }

  // The toolbar button: the tool spawns at the selected character, aimed at the selected token
  function handleAngleClick() {
    setAngleSpawn({ target: selection.find(p => p.kind === 'character') ?? null, aim: selection.find(p => p.kind === 'token') ?? null })
    setAngleOn(prev => !prev)
  }

  // over: true when the pointer moved onto the piece, false when it moved off
  function handlePieceHover(piece, over) {
    if (over) hoveredRef.current = piece
    else if (hoveredRef.current?.kind === piece.kind && hoveredRef.current.id === piece.id) hoveredRef.current = null
  }

  // Every key press of the app is handled here, so that the same key can do different things in
  // different states. The states now: a card or tray popup is open, or the table is in use.
  // The keys are in keyboard.js.
  function handleKeyDown(e) {
    if (tokenDrag) {
      // Escape cancels the drag. Other keys do nothing while a token is under the pointer.
      if (e.key === 'Escape') cancelTokenDrag()
      return
    }
    if (openCard || openTrayId || openRoster) {
      // Escape closes only the popup. The left and right arrows show the previous or next roster card.
      // Other keys do nothing, so nothing changes on the table behind it.
      if (e.key === 'Escape') { setOpenCard(null); setOpenTrayId(null); setOpenRoster(null) }
      else if (openRoster && CARD_STEP_KEYS[e.code]) handleRosterCardStep(CARD_STEP_KEYS[e.code])
      return
    }
    if (e.key === 'Escape') {
      // A dice tray face menu closes first, then the Library, before the table's own Escape behavior.
      if (diceMenu) { setDiceMenu(null); return }
      if (libraryOpen) { setLibraryOpen(false); return }
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
    // Over the player's dice tray, the number keys add dice, not tools
    if (DICE_KEYS[e.key] && diceTrayHoveredRef.current) {
      addDiceRef.current?.(DICE_KEYS[e.key])
      return
    }
    if (RANGE_KEYS[e.key]) handleToolKey('range', RANGE_KEYS[e.key])
    else if (MOVE_KEYS[e.key]) handleToolKey('move', MOVE_KEYS[e.key])
    else if (e.key === ANGLE_KEY) handleAngleKey()
    else if (e.key === CLEAR_TOOLS_KEY) clearTools()
  }

  function handleKeyUp(e) {
    heldPan.current.delete(e.code)
    heldTurn.current.delete(e.code)
    heldRotate.current.delete(e.code)
  }

  // A key released outside the window sends no keyup
  function handleBlur() {
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
    controls.object.position.set(...CAMERA_POSITION)
    controls.target.set(...CAMERA_TARGET)
    controls.update()
  }

  // Escape clears every selection: the character, the token and the tools. The selected tools are
  // also removed from the table.
  function handleEscape() {
    if (selectedTools.range) setActiveRange(null)
    if (selectedTools.move) setActiveMove(null)
    if (selectedTools.angle) setAngleOn(false)
    setSelectedTools(NO_TOOLS)
    setSelection(NO_PIECES)
  }

  // Key 0: removes every tool from the table. The selected pieces stay selected.
  function clearTools() {
    setActiveRange(null)
    setActiveMove(null)
    setAngleOn(false)
    setSelectedTools(NO_TOOLS)
  }

  // Key 6, the Toward / Away tool. With nothing under the pointer, it toggles the tool, the same as its
  // toolbar button. Over a character or a token, it selects that piece and spawns the tool again
  // snapped to it, even if the tool is already out. It aims at the character or token selected last
  // that is not that piece, or at the mat center.
  function handleAngleKey() {
    const piece = hoveredRef.current
    if (!piece) {
      handleAngleClick()
      return
    }
    setAngleSpawn({ target: piece, aim: selection.findLast(p => isToolPiece(p) && !(p.kind === piece.kind && p.id === piece.id)) ?? null })
    setSelection(prev => selectPiece(prev, piece))
    setAngleOn(true)
    setToolSpawns(prev => ({ ...prev, angle: prev.angle + 1 }))
  }

  // tool: 'range' | 'move'. value: the range number or the movement tool type.
  // Toggles the tool, the same as its toolbar button. With the pointer over a character or a token,
  // it selects that piece and spawns the tool again, snapped to it, even if the tool is already out.
  // A selected piece of the other kind stays selected.
  function handleToolKey(tool, value) {
    const piece = hoveredRef.current
    if (!piece) {
      if (tool === 'range') handleRangeClick(value)
      else handleMoveClick(value)
      return
    }
    setSelection(prev => selectPiece(prev, piece))
    if (tool === 'range') setActiveRange(value)
    else setActiveMove(value)
    setToolSpawns(prev => ({ ...prev, [tool]: prev[tool] + 1 }))
  }

  // F, as in TTS: flips the crisis token under the pointer (also one that a character holds), the
  // card of the character under the pointer (its model or its tray card), or the tactic card under
  // the pointer. With nothing under the pointer, it flips the token or character selected last (the
  // card of a character). A token without a back does not flip (handleTokenFlip).
  function handleFlipKey() {
    const piece = hoveredRef.current
      ?? (hoveredHeldRef.current && { kind: 'token', id: hoveredHeldRef.current })
      ?? (hoveredTrayCardRef.current && { kind: 'character', id: hoveredTrayCardRef.current })
      ?? (hoveredTacticRef.current && { kind: 'tactic', id: hoveredTacticRef.current })
      ?? selection.findLast(isToolPiece)
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
    setCrisis(prev => ({ ...prev, [type]: key }))
    setTokens(prev => {
      const kept = prev.filter(t => t.cardKey !== oldKey)
      const card = getCard(key)
      return card ? [...kept, ...buildMatTokens(card, setup.deck?.team === 'red')] : kept
    })
    // The selected token may no longer exist; a selected character is not affected.
    setSelection(prev => prev.filter(p => p.kind !== 'token'))
  }

  // A held token dragged off its tray card and released on the table is no longer held.
  function handleTokenMove(id, x, z) {
    setTokens(prev => prev.map(t => t.id === id ? { ...t, x, z, heldBy: null, heldAt: null } : t))
  }

  function handleTokenTurn(id, yaw) {
    setTokens(prev => prev.map(t => t.id === id ? { ...t, yaw } : t))
  }

  function handleTokenFlip(id) {
    setTokens(prev => prev.map(t => t.id === id && t.canFlip ? { ...t, up: t.up === 'front' ? 'back' : 'front' } : t))
  }

  function handleTokenControl(id, control) {
    setTokens(prev => prev.map(t => t.id === id ? { ...t, control } : t))
  }

  function handleTokenDamage(id, damage) {
    setTokens(prev => prev.map(t => t.id === id ? { ...t, damage } : t))
  }

  // A canHold token is released over a character (CrisisToken.jsx reports it, Scene.jsx finds the
  // character with characterAt): that character now holds it. The token leaves the mat (Scene.jsx
  // keeps heldBy tokens out of the tool snap list) and lies on its holder's tray card, on the
  // character art (trays.js, trayHeldDefault). No range check (see docs/feature-crisis.md, "Players
  // apply the rules"). cardPoint: the tray-local [x, z] on the character's card when the release
  // point is on its tray, otherwise null. It is used only to move a token on its own holder's card:
  // a token given to a character always goes to the default place.
  function handleTokenHold(id, characterId, cardPoint) {
    setTokens(prev => {
      const token = prev.find(t => t.id === id)
      if (!token) return prev
      if (token.heldBy === characterId) {
        return cardPoint ? prev.map(t => t.id === id ? { ...t, heldAt: cardPoint } : t) : prev
      }
      const heldCount = prev.filter(t => t.heldBy === characterId).length
      return prev.map(t => t.id === id ? { ...t, heldBy: characterId, heldAt: trayHeldDefault(heldCount) } : t)
    })
  }

  // A new supply token from the pile of a Source card (handleTokenRelease). Released over a
  // character: that character holds it, at the default place on its card, the same as
  // handleTokenHold. Otherwise it lies on the table at (x, z).
  function handleSupplyTake(cardKey, x, z, characterId) {
    const card = getCard(cardKey)
    if (!card?.supply) return
    setTokens(prev => {
      const token = supplyToken(card, x, z)
      if (!characterId) return [...prev, token]
      const heldCount = prev.filter(t => t.heldBy === characterId).length
      return [...prev, { ...token, heldBy: characterId, heldAt: trayHeldDefault(heldCount) }]
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
    if (!tokens.find(t => t.id === id)?.heldBy) return
    setTokens(prev => prev.filter(t => t.id !== id))
    setSelection(prev => deselectPiece(prev, { kind: 'token', id }))
  }

  // Drop, when its holder is removed: the token goes back on the table, next to the base of the
  // model that held it (the live Rapier/object position, not the spawn position, so a moved
  // character drops it where it stands). rowOffset moves it along the base's edge (+z of the +x drop
  // direction), so several tokens dropped together (handleDropCharacterTokens) land in a row
  // instead of stacked on each other. If the holder's position is not available (see Scene.jsx,
  // modelPosition), the token stays where it last sat on the mat. During the game, a player drops a
  // token by dragging it from the card to the table (handleTokenMove).
  function handleTokenDrop(id, rowOffset) {
    setTokens(prev => {
      const token = prev.find(t => t.id === id)
      if (!token?.heldBy) return prev
      const holder = characters.find(ch => ch.id === token.heldBy)
      const pos = modelPositionRef.current?.(token.heldBy)
      const baseRadius = holder ? BASE_DIAMETER[holder.base] / 2 : 0
      const x = (pos?.x ?? token.x) + baseRadius + TOKEN_RADIUS + DROP_GAP
      const z = (pos?.z ?? token.z) + rowOffset
      return prev.map(t => t.id === id ? { ...t, heldBy: null, heldAt: null, x, z } : t)
    })
  }

  // Phase 7 calls this for a character it is about to remove, so the character drops every token it
  // holds first (see docs/characters-hud.md, "Hold and drop"). Several tokens spread along a row
  // next to the base (TOKEN_ROW_SPACING apart) instead of landing on the same spot.
  function handleDropCharacterTokens(characterId) {
    const held = tokens.filter(t => t.heldBy === characterId)
    held.forEach((t, i) => {
      const rowOffset = (i - (held.length - 1) / 2) * TOKEN_ROW_SPACING
      handleTokenDrop(t.id, rowOffset)
    })
  }

  // Damage never goes below 0 or above the Stamina of the side that faces up (p16).
  function handleCharacterDamage(id, damage) {
    setCharacters(prev => prev.map(ch => {
      if (ch.id !== id) return ch
      const stamina = characterStamina(ch.key, ch.side)
      return { ...ch, damage: Math.max(0, Math.min(damage, stamina)) }
    }))
  }

  // Power never goes below 0 or above 10 (p7-8).
  function handleCharacterPower(id, power) {
    setCharacters(prev => prev.map(ch => ch.id === id ? { ...ch, power: Math.max(0, Math.min(power, 10)) } : ch))
  }

  // Flip turns the card to the other side and clears Damage, the same as in TTS.
  function handleCharacterFlip(id) {
    setCharacters(prev => prev.map(ch => ch.id === id
      ? { ...ch, side: ch.side === 'healthy' ? 'injured' : 'healthy', damage: 0 }
      : ch))
  }

  // Remove button on the tray (TrayControls.jsx confirms before calling this). Drops every token
  // the character holds first (p10), then removes the character: its model and its tray both come
  // from the same characters array (Scene.jsx), so one state update removes all three. Also clears
  // a selection or popup that still points at it, so nothing keeps the id or its Rapier body after
  // the model unmounts.
  function handleCharacterRemove(id) {
    handleDropCharacterTokens(id)
    setCharacters(prev => prev.filter(ch => ch.id !== id))
    setSelection(prev => deselectPiece(deselectPiece(prev, { kind: 'character', id }), { kind: 'character', id: secondModelId(id) }))
    setOpenTrayId(prev => prev === id ? null : prev)
  }

  // A short message in the HUD, for a few seconds (the immunity block below; the Library has its
  // own copy of this pattern for the "no 3D model" message).
  function showHudMessage(text) {
    clearTimeout(hudMessageTimer.current)
    setHudMessage(text)
    hudMessageTimer.current = setTimeout(() => setHudMessage(null), 3000)
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
    setRosters(prev => ({ ...prev, [team]: { code: formatMctCode(parsed) } }))
    // The open card may not be in the new roster
    setOpenRoster(prev => prev?.team === team ? null : prev)
    const restarted = restartSetup()
    if (parsed.unknown.length > 0) showHudMessage(unknownCodesMessage(parsed.unknown))
    else if (restarted) showHudMessage('Game setup started again')
  }

  function handleRosterRemove(team) {
    if (!confirmSetupRemoval('Remove this roster')) return
    setRosters(prev => ({ ...prev, [team]: null }))
    setOpenRoster(prev => prev?.team === team ? null : prev)
    if (restartSetup()) showHudMessage('Game setup started again')
  }

  // The rosters as parsed by rosters/mct.js: { blue, red } → parsed roster or null
  const parsedRosters = useMemo(() => ({
    blue: rosters.blue && parseRosterText(rosters.blue.code),
    red: rosters.red && parseRosterText(rosters.red.code),
  }), [rosters])

  // True when nothing that the setup put on the table would be removed, or the player confirms. action:
  // the start of the question, for example 'Load this roster'.
  function confirmSetupRemoval(action) {
    return !setupPlacedCards(setup) || window.confirm(`${action} and start the game setup again? ${SETUP_REMOVAL}`)
  }

  // Starts the game setup again. It removes what the setup put on the table: the characters and Team
  // Tactic cards of the activated squads, and the crisis cards of the mission with their tokens. A crisis
  // card that a player changed in the toolbar since then stays. So does the mat turn. Returns true when
  // the setup had started.
  function restartSetup() {
    setSquadSelect({ blue: false, red: false })
    if (setupStep(setup) === 'deck') return false
    setup.placed.characters.forEach(handleCharacterRemove)
    setTacticCards(prev => prev.filter(card => !setup.placed.tactics.includes(card.id)))
    if (setup.edge) {
      for (const type of CRISIS_TYPES) {
        const key = rosterCard(setup.picks[type])?.key
        if (key && crisis[type] === key) handleCrisisChange(type, null)
      }
    }
    setSetup(NEW_SETUP)
    return true
  }

  // The Restart setup button (GameSetup.jsx)
  function handleSetupRestart() {
    if (window.confirm(`Start the game setup again? ${SETUP_REMOVAL}`)) restartSetup()
  }

  // The roll-off winner uses their deck of `type`. The draws are random, so they are made here, outside a
  // state updater, which React can call twice.
  function handleSetupDeck(team, type) {
    if (setupStep(setup) !== 'deck' || !parsedRosters[team]) return
    setSetup(chooseDeck(setup, team, type, parsedRosters[team][type]))
  }

  // A Use button on a drawn crisis card. After the first card, 2 cards are drawn from the other deck of
  // the other player.
  function handleSetupPick(code) {
    const step = setupStep(setup)
    if (step !== 'first' && step !== 'second') return
    const other = parsedRosters[otherTeam(setup.deck.team)]
    setSetup(pickCard(setup, code, other?.[otherType(setup.deck.type)] ?? []))
  }

  function handleSetupThreat(threat) {
    if (setupStep(setup) === 'threat') setSetup(chooseThreat(setup, threat))
  }

  // Select board edge: the mat stays as it is now. The two crisis cards of the mission go to the ends of
  // the scoring board, and their tokens to the mat. A card without files in the app has no tokens.
  function handleSetupEdge() {
    if (setupStep(setup) !== 'edge') return
    const missing = []
    for (const type of CRISIS_TYPES) {
      const info = rosterCard(setup.picks[type])
      if (!info?.key) missing.push(info?.name ?? setup.picks[type])
      handleCrisisChange(type, info?.key ?? null)
    }
    setSetup(chooseEdge(setup))
    if (missing.length > 0) showHudMessage(`The app has no files for ${missing.join(' and ')}, so ${missing.length === 1 ? 'its' : 'their'} tokens are not on the mat`)
  }

  function handleSquadSelect(team) {
    setSquadSelect(prev => ({ ...prev, [team]: !prev[team] }))
  }

  // A click on a roster card. While the player chooses the squad, a character or Team Tactic card goes into
  // the squad or out of it. Only a card that the app can put on the table can join: a character with a
  // model, a Team Tactic card with an image. Otherwise the roster popup opens.
  function handleRosterClick(open) {
    const { team, tab, index } = open
    if (!squadSelect[team] || setupStep(setup) !== 'squads' || setup.ready[team] || (tab !== 'characters' && tab !== 'tactics')) {
      handleRosterOpen(open)
      return
    }
    const parsed = parsedRosters[team]
    const info = rosterCard(tab === 'characters' ? parsed.characters[index].code : parsed.tactics[index])
    const joins = !setup.squads[team][tab].includes(index)
    if (joins && tab === 'characters' && !info.model) {
      showHudMessage(`No model for ${info.name} (${info.code}), so it cannot join the squad`)
      return
    }
    if (joins && tab === 'tactics' && !info.key) {
      showHudMessage(`No card image for ${info.name} (${info.code}), so it cannot join the squad`)
      return
    }
    setSetup(toggleSquadCard(setup, team, tab, index))
  }

  // The Ready toggle of a player. Ready works when the squad has a character and its threat is not above the
  // Maximum Threat. While the player is Ready, their squad does not change. When the second player clicks
  // Ready, both squads go on the table at the same time (putSquadsOnTable).
  function handleSquadReady(team) {
    if (setupStep(setup) !== 'squads') return
    if (setup.ready[team]) {
      setSetup(toggleReady(setup, team))
      return
    }
    const squad = setup.squads[team]
    if (squad.characters.length === 0 || squadThreat(parsedRosters[team], squad.characters) > setup.threat) return
    setSquadSelect(prev => ({ ...prev, [team]: false }))
    if (setup.ready[otherTeam(team)]) putSquadsOnTable()
    else setSetup(toggleReady(setup, team))
  }

  // Both squads go on the table: the characters of each squad get their trays and models, and its Team
  // Tactic cards go into the tactic tray. A character or a Team Tactic card that the player already has on
  // the table is not added again. The roster cards leave the table (Scene.jsx). The new characters and
  // cards are made here, outside the state updaters, because the setup stores their ids for a restart, and
  // React can call an updater twice.
  function putSquadsOnTable() {
    const newCharacters = []
    const newCards = []
    for (const team of TEAMS) {
      const parsed = parsedRosters[team]
      const squad = setup.squads[team]
      for (const place of squad.characters) {
        const ch = characterByCode(parsed.characters[place].code)
        const onTable = [...characters, ...newCharacters].some(c => c.key === ch?.slug && c.teamColor === team)
        if (ch?.available && !onTable) newCharacters.push(newCharacter(ch, team))
      }
      for (const place of squad.tactics) {
        const key = rosterCard(parsed.tactics[place])?.key
        const cards = [...tacticCards, ...newCards]
        if (!key || cards.some(card => card.key === key && card.team === team)) continue
        const slot = firstFreeSlot(team, cards)
        newCards.push({ id: crypto.randomUUID(), key, team, x: slot.x, z: slot.z, up: 'face' })
      }
    }
    setCharacters(prev => [...prev, ...newCharacters])
    setTacticCards(prev => [...prev, ...newCards])
    setSetup(activateSquads(setup, { characters: newCharacters.map(ch => ch.id), tactics: newCards.map(card => card.id) }))
    setSquadSelect({ blue: false, red: false })
    setOpenRoster(null)
  }

  const setupActions = {
    deck: handleSetupDeck,
    pick: handleSetupPick,
    threat: handleSetupThreat,
    turnMat: handleTurnMat,
    edge: handleSetupEdge,
    squadSelect: handleSquadSelect,
    ready: handleSquadReady,
    restart: handleSetupRestart,
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

  // Shows the card `step` places away in the open tab of the roster popup. The tab is a loop: after the
  // last card comes the first.
  function handleRosterCardStep(step) {
    setOpenRoster(prev => {
      if (!prev || !rosters[prev.team]) return prev
      const count = rosterTabs(parseRosterText(rosters[prev.team].code))[prev.tab].length
      const index = (prev.index + step + count) % count
      return index === prev.index ? prev : { ...prev, index }
    })
  }

  // Gives one of tokenKey to a character. A character cannot get a condition it is immune to
  // (p21): the drop does nothing, the HUD shows why, and the result is false. Conditions, Activated
  // and Dazed stay at 1 at most (p17); every other token counts up (see docs/characters-hud.md,
  // "Players apply the rules"). The result is true then, also for a token at its limit: the
  // dropped token is used up, as in TTS, where the tray deletes it.
  function handleCharacterTokenGive(id, tokenKey) {
    const target = characters.find(ch => ch.id === id)
    if (target && characterImmune(target.key).includes(tokenKey)) {
      showHudMessage(`${characterName(target.key)} is immune to ${getToken(tokenKey)?.name ?? tokenKey}.`)
      return false
    }
    setCharacters(prev => prev.map(ch => {
      if (ch.id !== id) return ch
      const count = ch.tokens[tokenKey] ?? 0
      if (isCappedToken(tokenKey) && count >= 1) return ch
      return { ...ch, tokens: { ...ch.tokens, [tokenKey]: count + 1 } }
    }))
    return true
  }

  // A click on a token in the tray's "On" row removes one.
  function handleCharacterTokenRemove(id, tokenKey) {
    setCharacters(prev => prev.map(ch => {
      if (ch.id !== id) return ch
      const count = (ch.tokens[tokenKey] ?? 0) - 1
      const tokens = { ...ch.tokens }
      if (count > 0) tokens[tokenKey] = count
      else delete tokens[tokenKey]
      return { ...ch, tokens }
    }))
  }

  // over: the pointer moved onto (true) or off (false) a table token. A token that is removed or
  // dragged unmounts, which also ends its hover (see TokenFace.jsx).
  function handleLooseHover(id, over) {
    if (over) hoveredLooseRef.current = id
    else if (hoveredLooseRef.current === id) hoveredLooseRef.current = null
  }

  // Delete key over a token on the table, as in TTS
  function handleLooseRemove(id) {
    setLooseTokens(prev => prev.filter(t => t.id !== id))
  }

  // pointerdown on a character token: a tray's Give source (a new token, the source never runs out),
  // or a token on the table (looseId).
  function handleTokenDragStart(e, tokenKey, looseId = null) {
    startTokenDrag(e, { tokenKey, looseId })
  }

  // pointerdown on a Library token chip. mode 'single': a new token, the same as from a Give
  // source. mode 'pile': a new pile (see docs/feature-library.md, "Tokens").
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
    setTokenPiles(prev => prev.filter(p => p.id !== id))
  }

  // A click on a tactic card in the Library: the card goes into the first free slot of the team's
  // tactic tray, or next to the tray when its 5 slots are full. It lies face up.
  function handleTacticSpawn(key, team) {
    setTacticCards(prev => {
      const slot = firstFreeSlot(team, prev)
      return [...prev, { id: crypto.randomUUID(), key, team, x: slot.x, z: slot.z, up: 'face' }]
    })
  }

  // The end of a tactic card drag at table point (x, z). Over the plate of a tactic tray, the card goes
  // into the nearest free slot of that tray and faces that tray's player, the same as a TTS snap point.
  // Otherwise it lies at the point. The card moves to the end of the list, so it lies on top.
  function handleTacticMove(id, x, z) {
    setTacticCards(prev => {
      const card = prev.find(c => c.id === id)
      if (!card) return prev
      const team = tacticTrayAt({ x, z })
      const slot = team && nearestFreeSlot(team, { x, z }, prev, id)
      const moved = slot ? { ...card, team, x: slot.x, z: slot.z } : { ...card, x, z }
      return [...prev.filter(c => c.id !== id), moved]
    })
  }

  function handleTacticFlip(id) {
    setTacticCards(prev => prev.map(c => c.id === id ? { ...c, up: c.up === 'face' ? 'back' : 'face' } : c))
  }

  // Delete key over a tactic card
  function handleTacticRemove(id) {
    setTacticCards(prev => prev.filter(c => c.id !== id))
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
  // camera does not move during the drag. A pointerdown on the canvas also starts an OrbitControls
  // drag, which captures the pointer, so the capture is released, the same as CrisisToken.jsx.
  // drag: tokenKey and the fields of tokenDrag that are set, the others get their defaults.
  function startTokenDrag(e, drag) {
    e.preventDefault()
    e.stopPropagation()
    if (e.target?.hasPointerCapture?.(e.pointerId)) e.target.releasePointerCapture(e.pointerId)
    if (controlsRef.current) controlsRef.current.enabled = false
    const full = { looseId: null, supplyCard: null, pile: false, pileId: null, ...drag }
    tokenDragRef.current = { ...full, startX: e.clientX, startY: e.clientY, active: false }
    setTokenDrag({ ...full, active: false, start: null })
  }

  function cancelTokenDrag() {
    tokenDragRef.current = null
    setTokenDrag(null)
    if (controlsRef.current) controlsRef.current.enabled = true
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
    const { tokenKey, looseId, supplyCard, pile, pileId } = tokenDragRef.current
    if (!document.elementFromPoint(clientX, clientY)?.closest('.scene-root')) return
    const characterId = findCharacterAt(clientX, clientY)
    if (pile || pileId) {
      const point = dragPointRef.current
      if (characterId || !point) return
      if (pileId) setTokenPiles(prev => prev.map(p => p.id === pileId ? { ...p, x: point.x, z: point.z } : p))
      else setTokenPiles(prev => [...prev, { id: crypto.randomUUID(), key: tokenKey, x: point.x, z: point.z }])
      return
    }
    if (supplyCard) {
      const point = dragPointRef.current
      const pile = supplyPilePosition(getCard(supplyCard).type)
      if (characterId) handleSupplyTake(supplyCard, pile.x, pile.z, characterId)
      else if (point) handleSupplyTake(supplyCard, point.x, point.z, null)
      return
    }
    if (characterId) {
      if (handleCharacterTokenGive(characterId, tokenKey) && looseId) handleLooseRemove(looseId)
      return
    }
    const point = dragPointRef.current
    if (!point) return
    if (looseId) setLooseTokens(prev => prev.map(t => t.id === looseId ? { ...t, x: point.x, z: point.z } : t))
    else setLooseTokens(prev => [...prev, { id: crypto.randomUUID(), key: tokenKey, x: point.x, z: point.z }])
  }

  // Window listeners for the token drag: it becomes active after DRAG_THRESHOLD px, and its release
  // drops the token (handleTokenRelease). A release before that is a click, which does nothing.
  // Escape cancels (see handleKeyDown).
  useEffect(() => {
    if (!tokenDrag) return undefined
    function handleMove(e) {
      const drag = tokenDragRef.current
      if (!drag || drag.active || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return
      drag.active = true
      setTokenDrag(prev => prev && { ...prev, active: true, start: { clientX: e.clientX, clientY: e.clientY } })
    }
    function handleUp(e) {
      if (tokenDragRef.current?.active) handleTokenRelease(e.clientX, e.clientY)
      cancelTokenDrag()
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [tokenDrag])

  const selectedTokenId = selectedId(selection, 'token')
  const selectedToken = tokens.find(t => t.id === selectedTokenId) ?? null
  const openTray = openTrayId ? characters.find(ch => ch.id === openTrayId) ?? null : null

  // Debug mode is only in the dev server. import.meta.env.DEV is false in `vite build`, so debug
  // is always false there and the build leaves out the debug code.
  const debug = import.meta.env.DEV && debugOn
  const mode = debug ? renderMode : 'full'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Holds the Canvas only: isolation: isolate (index.css) keeps every drei <Html> wrapper it
          mounts (terrain labels, the ruler tool, the tray controls) from ever drawing over the
          HUD below, no matter its z-index. See index.css, .scene-root. */}
      <div className="scene-root">
        <Canvas
          shadows
          camera={{ position: CAMERA_POSITION, fov: 50 }}
          // The EffectComposer in SelectionOutlines renders the scene with its own antialiasing (multisampling)
          gl={{ antialias: false }}
          events={canvasEvents}
          // A click with no piece under the pointer (table, terrain, background) clears the selected
          // pieces. The selected tools stay selected.
          // R3F does not count a camera drag as a click. A right click is a 'contextmenu' event, and it also
          // starts a camera turn, so it does not clear. Clicks on tool buttons (Html) are not on the canvas.
          onPointerMissed={e => { if (e.type === 'click' && e.target instanceof HTMLCanvasElement) setSelection(NO_PIECES) }}
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
              terrain={terrain}
              onTerrainHover={handleTerrainHover}
              terrainAtRef={terrainAtRef}
              characters={characters}
              activeRange={activeRange}
              activeMove={activeMove}
              angleOn={angleOn}
              angleSpawn={angleSpawn}
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
              toolSpawns={toolSpawns}
              onTokenMove={handleTokenMove}
              onTokenTurn={handleTokenTurn}
              onTokenHold={handleTokenHold}
              onHeldHover={handleHeldHover}
              onSupplyDragStart={handleSupplyDragStart}
              onCharacterDamage={handleCharacterDamage}
              onCharacterPower={handleCharacterPower}
              onCharacterFlip={handleCharacterFlip}
              onTrayCardHover={handleTrayCardHover}
              onCharacterRemove={handleCharacterRemove}
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
              onCardOpen={setOpenCard}
              onTrayOpen={setOpenTrayId}
              diceMenu={diceMenu}
              onDiceMenuToggle={handleDiceMenuToggle}
              onDiceMenuClose={handleDiceMenuClose}
              characterAtRef={characterAtRef}
              findCharacterAt={findCharacterAt}
              modelPositionRef={modelPositionRef}
              turnPieceRef={turnPieceRef}
              liftPieceRef={liftPieceRef}
              onDiceTrayHover={over => { diceTrayHoveredRef.current = over }}
              addDiceRef={addDiceRef}
              heldRotate={heldRotate}
              scoreMarkers={scoreMarkers}
              affiliations={affiliations}
              rosters={rosters}
              onRosterOpen={handleRosterClick}
              setup={setup}
              squadSelect={squadSelect}
              setupActions={setupActions}
              onScoreMarkerMove={(marker, x, z) => setScoreMarkers(prev => ({ ...prev, [marker]: { x, z } }))}
              startPoses={start.poses}
              modelPosesRef={modelPosesRef}
            />
          </SelectionOutlines>
          <OrbitControls
            ref={controlsRef}
            makeDefault
            target={CAMERA_TARGET}
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
          onDebugClick={() => setDebugOn(prev => !prev)}
          showLabels={showLabels}
          onLabelsClick={() => setShowLabels(prev => !prev)}
          spectator={spectator}
          onSpectatorClick={() => setSpectator(prev => !prev)}
          onTurnMat={handleTurnMat}
          deployLine={deployLine}
          onDeployLineClick={() => setDeployLine(prev => !prev)}
          crisis={crisis}
          onCrisisChange={handleCrisisChange}
          onRosterLoad={handleRosterLoad}
          onRosterRemove={handleRosterRemove}
          libraryOpen={libraryOpen}
          onLibraryClick={() => setLibraryOpen(prev => !prev)}
        />
      </div>
      <TokenPanel
        token={selectedToken}
        onFlip={() => handleTokenFlip(selectedToken.id)}
        onControl={control => handleTokenControl(selectedToken.id, control)}
        onDamage={damage => handleTokenDamage(selectedToken.id, damage)}
      />
      <Library
        open={libraryOpen}
        characters={characters}
        onSpawnCharacter={handleSpawn}
        onSpawnTactic={handleTacticSpawn}
        onTokenDragStart={handleLibraryTokenDragStart}
      />
      <CardPopup card={openCard} onClose={() => setOpenCard(null)} />
      {openRoster && rosters[openRoster.team] && (
        <RosterPopup
          team={openRoster.team}
          code={rosters[openRoster.team].code}
          tab={openRoster.tab}
          index={openRoster.index}
          onTabChange={tab => setOpenRoster(prev => prev && { ...prev, tab, index: 0 })}
          onIndexChange={index => setOpenRoster(prev => !prev || index === prev.index ? prev : { ...prev, index })}
          onClose={() => setOpenRoster(null)}
        />
      )}
      {openTray && (
        <TrayPopup
          character={openTray}
          heldTokens={tokens.filter(tok => tok.heldBy === openTray.id)}
          onClose={() => setOpenTrayId(null)}
          onDamage={damage => handleCharacterDamage(openTray.id, damage)}
          onPower={power => handleCharacterPower(openTray.id, power)}
          onFlip={() => handleCharacterFlip(openTray.id)}
          onRemove={() => handleCharacterRemove(openTray.id)}
          onTokenRemove={key => handleCharacterTokenRemove(openTray.id, key)}
        />
      )}
      {hudMessage && <div className="hud-message">{hudMessage}</div>}
      {softwareRenderer && (
        <div className="hud-warning" role="alert" title={softwareRenderer}>
          <span>
            The browser draws the 3D view without the graphics card (software rendering), so the app is slow.
            Turn on hardware acceleration in the browser settings.
          </span>
          <button type="button" className="chip" onClick={() => setSoftwareRenderer(null)}>Close</button>
        </div>
      )}
      {debug && <DebugPanel renderMode={renderMode} onRenderModeChange={setRenderMode} />}
      <LoadingOverlay ready={ready} />
    </div>
  )
}
