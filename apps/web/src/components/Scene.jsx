import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Raycaster, Vector3 } from 'three'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import {
  MovementRuler,
  AngleRuler,
  RangeRuler,
  DeployRangeTool,
  OtherTool,
  sameModel,
} from './RulerTool.jsx'
import CharacterModel, { StandeeModel, modelUrls, turnBody } from './CharacterModel.jsx'
import CharacterTray from './CharacterTray.jsx'
import TableButtons from './TableButtons.jsx'
import { LosTool, OtherLos } from './LosTool.jsx'
import ToolRack from './ToolRack.jsx'
import ToolDragGhost from './ToolDragGhost.jsx'
import SpectatorBadge from './SpectatorBadge.jsx'
import { heldTokensByCharacter } from '../game/heldTokens.js'
import Terrain from './Terrain.jsx'
import CrisisCard from './CrisisCard.jsx'
import CrisisToken, { TOKEN_RADIUS } from './CrisisToken.jsx'
import { clampWaiting } from '../tokens/dropWait.js'
import LooseToken from './LooseToken.jsx'
import TokenDragPreview, { OtherSpawnPreview } from './TokenDragPreview.jsx'
import ToolPoint from './ToolPoint.jsx'
import LiveSync from './LiveSync.jsx'
import RemoteCursor from './RemoteCursor.jsx'
import Ping from './Ping.jsx'
import TokenFace from './TokenFace.jsx'
import SupplyPile, { SupplyToken } from './SupplyPile.jsx'
import TokenPile, { PileStack } from './TokenPile.jsx'
import TacticTray from './TacticTray.jsx'
import TacticCard from './TacticCard.jsx'
import RosterCards from './RosterCards.jsx'
import GameSetup from './GameSetup.jsx'
import DiceTray from './DiceTray.jsx'
import OtherDiceTray from './OtherDiceTray.jsx'
import ScoreBoard from './ScoreBoard.jsx'
import PriorityMarker from './PriorityMarker.jsx'
import { Backdrop, Mat, SceneLights, TableSurface, matImageUrl } from './SceneShared.jsx'
import { BASE_DIAMETER } from '../characters/files.js'
import { MAPS } from '../terrain/maps/index.js'
import {
  characterGiveSources,
  characterName,
  characterSize,
  characterStamina,
} from '../characters/characters.js'
import {
  characterModels,
  characterOnBoard,
  modelCardFile,
  modelCharacterId,
  modelFigureYaw,
  modelSpawnYaw,
  trayCards,
  yawQuaternion,
} from '../characters/models.js'
import { FRICTION, WORLD_GRAVITY } from '../physics.js'
import { overlapMarks, overlapsAny } from '../characters/overlap.js'
import { claimChanges, claimCheck, modelIdOfKey, modelKey } from '../characters/claims.js'
import { assetUrl } from '../assets/index.js'
import { CARD_X, CARD_Y, CARD_Z, supplyPilePosition } from '../crisis/layout.js'
import { getCard } from '../crisis/cards.js'
import { TRAYS } from '../dice/tray.js'
import {
  TRAY_Y,
  gruntsByHost,
  inTrayArea,
  layoutTrays,
  onTray,
  trayHeldLocal,
  trayHeldWorld,
  trayModelPosition,
  traySpareModelPosition,
  trayConstructPosition,
  trayGruntHeldClamp,
  trayGruntHeldLocal,
  trayGruntModelPosition,
  trayGruntSlot,
  trayYaw,
} from '../characters/trays.js'
import { TOKEN_THICKNESS } from '../tokens/solid.js'
import { tokenSize } from '../tokens/tokens.js'
import { MAT_SIZE, TABLE_WALLS } from '../table.js'
import { RANGE_TIP } from '../tabletools/toolTips.js'
import {
  NO_PIECES,
  NO_TOOLS,
  isToolPiece,
  selectPiece,
  selectedId,
  toggleSelectPiece,
  toolSelects,
} from '../selection.js'
import { poseOf } from '../rooms/table.js'
import { rackHiddenSides, rosterRowsShown, setupStep, viewOf } from '../setup/setup.js'
import { useSideColors } from '../sideColors.js'

// Tools hang this far above the table and measure by the outline cast below them
const TOOL_HOVER_HEIGHT = 1
// Two physics steps per frame. With one, a model dropped from high up sometimes gets stuck in terrain.
const TIME_STEP = 1 / 120
// Tokens held by one character lie on its card in a stack, in the order they were taken, so two
// tokens that overlap do not z-fight. Each one is this much higher than the one before it.
const HELD_STACK_STEP = TOKEN_THICKNESS + 0.01
// The dragged token gets no pointer events, so it does not hide what is under it
const NO_RAYCAST = () => null
// One Q / E press turns a piece this much. The TTS default (PointerRotationSnap in the TTS settings, read on 2026-10-05).
const ROTATE_STEP = (15 * Math.PI) / 180
// A Q / E key held longer than this (s) turns the piece on at ROTATE_RATE (rad/s), 90° per second,
// the same as the arrow keys turn the camera. Picked by look, not measured in TTS.
const ROTATE_HOLD_DELAY = 0.3
const ROTATE_RATE = Math.PI / 2
// A turn is smoothed, the same way as the wheel zoom (WheelCamera.jsx). Each frame the piece does
// 1 − e^(−dt / time) of the turn that is left, so 95% of a step is done after three times this (s).
// Picked by look. When less than ROTATE_DONE (rad) is left, the rest is done in the same frame.
const ROTATE_SMOOTH_TIME = 0.06
const ROTATE_DONE = 1e-4

// Every piece that loads a file after the first scene load (the mat of a new map, terrain, crisis
// cards and tokens, character trays and models, tactic cards, tools) is in its own Suspense below. While its file
// loads, only that piece is not drawn. Without its own Suspense, the load hides the whole scene (the
// Suspense that React Three Fiber puts around the Canvas content), and the screen flashes black.
// The map and the models of a new table are loaded before the scene mounts (Preload.jsx), so they show
// in the first frame.

// The mat image of a map. Preload.jsx loads it before a table shows (docs/features/rooms.md, "Loading").
export function matUrl(mapId) {
  return matImageUrl(MAPS[mapId].mat)
}

const NO_TOOLS_RECORD = {}
const NO_POSES = {}
// The other player's claims when there is no ownership
const NO_KEYS = new Set()
const noSubscribe = () => () => {}
const noKeys = () => NO_KEYS
const noDrag = () => null
const noSpawn = () => null
const NO_PRESENCE = { selection: [], tools: [], mark: null, ping: null }
const noPresence = () => NO_PRESENCE

// Two stored poses are the same (both rounded the same way, rooms/table.js, poseOf)
function samePose(a, b) {
  return (
    Boolean(a && b) &&
    a.x === b.x &&
    a.y === b.y &&
    a.z === b.z &&
    a.qx === b.qx &&
    a.qy === b.qy &&
    a.qz === b.qz &&
    a.qw === b.qw
  )
}

// Frames a body waits after a pose is set, before it is put to sleep. A sleeping body is not synced to its
// mesh, so the mesh must follow the new pose first.
const SLEEP_AFTER_FRAMES = 2

// How often (ms) Scene looks for overlapping models
const OVERLAP_INTERVAL = 100

// The tray that character ch is on: the number of host cards, the number of grunt cards on it, and the
// offset of ch's own card from the host card ([0, 0] for a host). gruntLists: gruntsByHost (trays.js).
function trayShapeOf(ch, characters, gruntLists) {
  const host = ch.host ? (characters.find((c) => c.id === ch.host) ?? ch) : ch
  const list = gruntLists.get(host.id) ?? []
  return {
    cards: trayCards(host),
    grunts: list.length,
    index: Math.max(0, list.indexOf(ch)),
    slot: ch.host ? trayGruntSlot(trayCards(host), Math.max(0, list.indexOf(ch))) : [0, 0],
  }
}

// mapId: key in MAPS. terrain: the terrain pieces on the mat, [{ id, locked, ...placement }] (see
// mapTerrain in rooms/table.js). onTerrainHover(id, over): the pointer moved onto or off an unlocked piece,
// for the Delete key. terrainAtRef: ref App calls for the L key, the same pattern as characterAtRef.
// Scene fills it with terrainAt.
// showColliders: draw every physics collider as lines (the shapes physics uses, not the visible meshes)
// showLabels: show the label (name, game Size, lock state) above each terrain piece. With labels off, the
// piece under the pointer shows its label.
// spectator: show the spectator view above each model (SpectatorBadge.jsx)
// matTurns: number of 90° counter-clockwise turns of the mat and its terrain
// crisis: { secure, extract } chosen card keys. tokens: every crisis token on the table (see App.jsx).
// selection: the selected pieces (see selection.js), lifted to App. onSelectionChange: the setter,
// called with a value or an updater function.
// onPieceHover(piece, over): the pointer moved onto (true) or off (false) a character or a token,
// piece as { kind, id }. tools: the `tools` record of the document, side → kind → entry (storedTool.js).
// ownSide: 'host' or 'guest', the side of this browser. The own entries become tools; the key of a tool is
// its `which` and `spawn`, so a new spawn mounts it again. The entry of the other side that has a pose
// becomes an OtherTool. onToolStore(kind, spawn, fields): a tool of the own side rests, App writes the
// fields into its entry. onToolReturn(kind): a move drag of an own tool ended on the own rack, App removes the tool
// (RulerTool.jsx, onReturn). Undefined: the tools do not return. onToolRemove(kind): a tool is removed for
// another reason (the Line of Sight looker left the table), always set. toolPointRef: ref App calls, filled by ToolPoint with { atPointer(), atCenter() }.
// selectedTools: { range, move, angle } (see selection.js), lifted to App with its setter onSelectedToolsChange.
// angleSpawn: { target, aim }, each { kind, id } | null, for the Toward / Away tool:
// the piece it snaps to when it spawns (free without one), and the piece it aims at (the mat center
// without one). Like the other tools, it measures against the piece selected last.
// toolSpawn: { range, move }, each { kind, id } | null: the piece the range or movement tool snaps to when
// it spawns. Set by a tool key over a piece, which may be a model that the key does not select. Without
// one, the tool snaps to the selected piece (target).
// onCharacterDamage(id, damage), onCharacterPower(id, power), onCharacterFlip(id): the tray's
// controls, lifted to App the same way as the token handlers above (see TrayControls.jsx).
// onTrayCardHover(id, over): the pointer moved onto (true) or off (false) a character's tray card,
// for the F key.
// onCharacterOffBoard(id): the tray's Remove button, enabled while a model of the character is on the mat.
// onCharacterTokenRemove(id, key): a click on a token in the tray's "On" row.
// onTokenDragStart(e, key, looseId, giveId): pointerdown on a tray's Give source (giveId: the character of the
// tray), or on a token on the table (looseId). See drag/useTokenDrag.js, handleTokenDragStart.
// onCardHover(card, over): the pointer moved onto or off a card or a model, card as { src, alt, by }, for Alt
// (App.jsx).
// looseTokens: the character tokens that lie on the table, [{ id, key, x, z }] (see App.jsx).
// onLooseHover(id, over): the pointer moved onto or off one of them, for the Delete key.
// tokenPiles: the piles of character tokens on the table, [{ id, key, x, z }] (see TokenPile.jsx).
// onPileTakeStart(e, pile), onPileMoveStart(e, pile): a drag on a pile takes a token, or with Shift
// moves the pile. onPileHover(id, over): for the Delete key.
// tacticCards: the Team Tactic cards on the table (see TacticCard.jsx and App.jsx). onTacticMove(id,
// x, z): a card drag ended over the table. onTacticHover(id, over): for the F and Delete keys. A
// click on a card opens it with onCardOpen, the same as a crisis card.
// toolDrag: the drag of a tool from the rack, { kind, which, active, start } | null (tabletools/useTableTools.js). While it is active, a
// flat outline of the tool follows the pointer (ToolDragGhost). toolDragPointRef: the ghost writes the table point
// under the pointer there, for the drop (useTableTools.js).
// tokenDrag: the token drag in progress, see drag/useTokenDrag.js. While it is active, the dragged token shows
// under the pointer (TokenDragPreview) and, for a token from the table, not in its old place.
// dragPointRef: the preview writes the table point under the pointer there, for the release in drag/useTokenDrag.js.
// rosters: { host, guest } → null | { code }, the loaded rosters (RosterCards.jsx). onRosterOpen({ team, tab,
// index }): a click on a roster card. It opens the roster popup on that card (see RosterPopup.jsx).
// onCrisisOpen({ team, type, code, drawn }): a click on a crisis card of the setup (GameSetup.jsx).
// squadEdit: { host, guest } → true: the roster cards of that side have the + / ✓ button, and onSquadToggle(team,
// tab, index) adds the card to the squad or removes it (setup/useGameSetup.js, handleSquadToggle).
// setup: the game setup (setup/setup.js). setupActions, mySide, seatPlayers: see GameSetup.jsx. When the squads
// are on the table, the roster cards are not.
// onCardOpen({ src, alt }): a click on a crisis card (see CardPopup.jsx). onTrayOpen(id): a click
// on a tray card opens the whole tray (see TrayPopup.jsx). onAttachedOpen(code): a click on a gem chip
// of a tray opens the gem card (App.jsx, handleAttachedOpen).
// diceMenu: the open "Change to" menu of a shelf die, { trayKey, dieId } | null, lifted to App so
// Escape can close it. onDiceMenuOpen(trayKey, dieId), onDiceMenuClose(): see DiceTray.jsx.
// characterAtRef: ref App calls with (clientX, clientY) to find the character under the pointer,
// the same pattern as bodyRef. Scene fills it with its own characterAt (3D only: the model
// or the tray's background plate), used by App's findCharacterAt below.
// findCharacterAt(clientX, clientY): App's own lookup, the DOM tray controls (data-character-id)
// first, then characterAtRef's characterAt. Passed back down so CrisisToken.jsx's Extract-token
// release uses the same lookup as App's token drag, instead of 3D-only characterAt, so a
// release over the tray's controls strip (DOM) counts too.
// modelPositionRef: ref App calls with a character id to get its live table position { x, z }
// (Rapier body or model object, not the spawn position), or null. Used by handleTokenDrop in crisis/useCrisisTokens.js, the
// same pattern as characterAtRef. See "Hold and drop".
// turnPieceRef: ref App calls with a direction for Q / E, the same pattern as characterAtRef. Scene
// fills it with turnPiece. heldRotate: ref to a Map of the Q / E actions held down, action id → direction.
// floorPieceRef: ref App calls for R during a model drag. Scene fills it with floorPiece. modelDragRef:
// Scene sets its current to the id of the dragged own model, else null.
// liftPieceRef: ref App calls for R, the same pattern. Scene fills it with liftPiece.
// returnModelsRef: ref App calls with a character id for the tray's Remove button, the same pattern.
// Scene fills it with returnModels: the models of that character go back to their places on the tray.
// playedSides: the sides this browser plays (dice tray, tool snap selection), one in a multiplayer
// room, both otherwise.
// A token with placeBy can be dragged only by a browser that plays that side (tokens/dropWait.js).
// removeWaits: character id → the text that disables its Remove button while a dropped token waits, or no entry.
// The other tray is only drawn (OtherDiceTray.jsx).
// onDiceTrayHover(side, over): the pointer moved onto or off an own dice tray, for the number keys.
// addDiceRef: ref App calls with a side and a count for the number keys over that tray. Each own
// tray puts a function there that clears the tray, then adds that many dice (DiceTray.jsx).
// diceStore: the dice record store of the table; each tray reads and writes its side (DiceTray.jsx).
// rollsStore: the roll history list. transact(fn): fn writes several stores as one change.
// onTokenHold(tokenId, characterId, cardPoint): a canHold token was released over a character.
// cardPoint: the tray-local [x, z] on that character's card (trays.js, trayHeldLocal) when the
// release point is on its tray, otherwise null.
// onHeldHover(tokenId, over): the pointer moved onto or off a crisis token that a character holds,
// for the Delete key, the same as onLooseHover.
// onSupplyDragStart(e, cardKey): pointerdown on the supply pile of a Source card (SupplyPile.jsx).
// scoreMarkers, affiliations, onScoreMarkerMove(marker, x, z): the scoring board markers, see
// ScoreBoard.jsx.
// priority, priorityTitle, onPriorityClick: the Priority marker (PriorityMarker.jsx). priority: the side, or null.
// startPose(modelId): the stored pose { x, y, z, qx, qy, qz, qw } of a model (rooms/table.js, poseOf), or
// undefined. A model with a pose starts there instead of on its tray. Read when the model mounts.
// onModelRest(modelId, pose): the body of a model fell asleep. App stores the pose in the table document, so
// the model starts there when the table opens again (docs/plans/implement-backend/05-yjs-state.md, decision 8).
// presence: what the other player looks at (net/presence.js). Scene writes the own range mark and reads the other's
// selection and mark. ownership: the claims on pieces (net/ownership.js). Pieces without a body pass it to the drag code. Scene
// claims a model before R, Q / E, Throw, Place and a drag, releases it when the body rests, and writes the rest
// pose (plan 09, decisions 5 to 9).
// ownPing: the last ping of this browser (App, key P). The other player's ping comes with presence (ping.md).
// live: the live hub of a multiplayer room (net/live.js), or null. With it, Scene mounts LiveSync and the cursor.
// pieceLives: a Map, piece key → getter of the live pose of a dragged piece without a body. The drag code fills it and
// LiveSync sends it (plan 09, Phase 6). The pieces follow the other player's live poses while they claim them.
// poses: the live rest poses of the models, model id → pose (the table document). A pose that the other browser
// wrote moves the body (decision 8). startPose is the pose at mount.
export default function Scene({
  mapId,
  tableButtons,
  toolRack,
  terrain = [],
  onTerrainHover,
  terrainAtRef,
  characters = [],
  tools = NO_TOOLS_RECORD,
  ownSide = 'host',
  onToolStore,
  onToolReturn,
  onToolRemove,
  angleSpawn = { target: null, aim: null },
  toolSpawn = { range: null, move: null },
  showColliders = false,
  showLabels = false,
  spectator = false,
  matTurns = 0,
  deployLine = false,
  crisis = { secure: null, extract: null },
  tokens = [],
  selection = NO_PIECES,
  onSelectionChange,
  selectedTools = NO_TOOLS,
  onSelectedToolsChange,
  onPieceHover,
  toolPointRef,
  onTokenMove,
  onTokenTurn,
  onTokenHold,
  onHeldHover,
  onSupplyDragStart,
  onCharacterDamage,
  onCharacterPower,
  onCharacterFlip,
  onTrayCardHover,
  onCardHover,
  onCharacterOffBoard,
  onCharacterTokenRemove,
  onTokenDragStart,
  looseTokens = [],
  onLooseHover,
  tokenPiles = [],
  onPileTakeStart,
  onPileMoveStart,
  onPileHover,
  tacticCards = [],
  onTacticMove,
  onTacticHover,
  tokenDrag = null,
  toolDrag = null,
  toolDragPointRef,
  dragPointRef,
  onCardOpen,
  onTrayOpen,
  onAttachedOpen,
  diceMenu = null,
  onDiceMenuOpen,
  onDiceMenuClose,
  characterAtRef,
  findCharacterAt,
  modelPositionRef,
  turnPieceRef,
  liftPieceRef,
  floorPieceRef,
  modelDragRef,
  returnModelsRef,
  playedSides = ['host', 'guest'],
  removeWaits = {},
  onDiceTrayHover,
  addDiceRef,
  diceStore,
  rollsStore,
  transact,
  heldRotate,
  scoreMarkers,
  affiliations,
  rosters = { host: null, guest: null },
  onRosterOpen,
  onCrisisOpen,
  setup,
  squadEdit,
  onSquadToggle,
  setupActions,
  mySide = null,
  seatPlayers = null,
  onScoreMarkerMove,
  priority,
  priorityTitle,
  onPriorityClick,
  poses = NO_POSES,
  startPose,
  onModelRest,
  ownership = null,
  presence = null,
  ownPing = null,
  live = null,
  pieceLives = null,
}) {
  const { camera, gl, pointer } = useThree()
  // The maps below are keyed by model id: a character with a second form has two models (see
  // characters/models.js). The first model has the character's own id.
  // Model id → Rapier body. Tools read and move characters through it.
  const charBodies = useRef(new Map())
  // Model id → 3D object. Tools find the character under the pointer with it.
  const charObjects = useRef(new Map())
  // Model id → its lift, { toggle(), down() }. See CharacterModel.jsx and liftPiece.
  const charLifts = useRef(new Map())
  // Character id → the tray's background plate. characterAt below hits this too, so a drop anywhere
  // on the tray finds the character (see CharacterTray.jsx).
  const trayObjects = useRef(new Map())
  // Terrain piece id → its visible mesh, for terrainAt
  const terrainObjects = useRef(new Map())
  const raycaster = useRef(new Raycaster())
  // Token id → 3D object, and token id → live center getter. The same purpose as charBodies and
  // charObjects, but a token has no Rapier body (see CrisisToken.jsx).
  const tokenObjects = useRef(new Map())
  const tokenCenters = useRef(new Map())
  // Tool ('move' or 'range') → { owns(model, p), clamp(p, model) } while its Place, Place 1 or Throw is on,
  // else null. A drag of the model that the tool owns is limited by it (see onPlaceLimit in RulerTool.jsx).
  const placeLimits = useRef({})
  // The own tool that has Place or Throw on: 'range', 'move' or null. Only one at a time. The other tool turns
  // its own off (limitTaken in RulerTool.jsx). A tool that turns off clears only its slot in placeLimits.
  const [limitTool, setLimitTool] = useState(null)
  // The pieces that Q / E can turn (turnPiece): the character or tool under the pointer, and the one
  // that is dragged. { kind: 'character' | 'tool', id } | null. The id of a tool is 'range', 'move', 'angle' or 'los'.
  const hoveredPiece = useRef(null)
  const draggedPiece = useRef(null)
  // Tool ('move', 'range', 'angle' or 'los') → its turn(angle), see turnAroundCenter in RulerTool.jsx
  const toolTurns = useRef({})
  // The own tools' live poses for LiveSync: kind → a getter that Tool registers (like toolTurns)
  const toolLives = useRef({})
  // The own dice's live poses for LiveSync: tray side → a getter that DiceTray registers
  const diceLives = useRef({})
  // What LiveSync received: { pose(key), poseTime(key), tool(kind), die(key), cursor() }, or null (LiveSync.jsx)
  const received = useRef(null)
  // The latest live numbers of a piece key, for the pieces that follow
  const getPieceLive = (key) => received.current?.pose(key) ?? null
  const getPieceLiveTime = (key) => received.current?.poseTime(key) ?? null
  // Turns that are not done yet: piece key → { piece, left }, left in radians. See the useFrame below.
  const turnsLeft = useRef(new Map())
  // Function of the angle tool that returns { target, openYaw } while it is snapped, else null. See AngleRuler.
  const angleTool = useRef(null)
  // The piece of the last Q / E press, which a held key turns on, and the time since that press (s)
  const turnHold = useRef({ piece: null, time: 0 })
  const [draggingCharId, setDraggingCharId] = useState(null)
  // The piece that a range tool measures against, { kind, id, mode: 'inRange' | 'outOfRange' } or null.
  // See RangeMark in RulerTool.jsx.
  const [rangeMark, setRangeMark] = useState(null)
  // Model id → number that grows with each move of the model (overlap.js). A model that never moved has none.
  const moved = useRef(new Map())
  const moveCount = useRef(0)
  const markMoved = (id) => moved.current.set(id, ++moveCount.current)
  // The keys that the other player claims. Their models are remote (CharacterModel.jsx).
  const otherOwned = useSyncExternalStore(
    ownership?.subscribe ?? noSubscribe,
    ownership?.otherOwned ?? noKeys,
  )
  // The piece key of the model that the other player drags now (decision 20)
  const otherDragKey = useSyncExternalStore(
    ownership?.subscribe ?? noSubscribe,
    ownership?.otherDrag ?? noDrag,
  )
  // The new piece that the other player drags now, { key, tokenKey }, or null (decision 22)
  const otherSpawn = useSyncExternalStore(
    ownership?.subscribe ?? noSubscribe,
    ownership?.otherSpawn ?? noSpawn,
  )
  // What the other player has selected and which piece their range tool marks (decisions 24 and 25)
  const otherLook = useSyncExternalStore(
    presence?.subscribe ?? noSubscribe,
    presence?.other ?? noPresence,
  )
  useEffect(() => {
    presence?.set({
      mark: rangeMark && {
        key: `${rangeMark.kind}:${rangeMark.id}`,
        mode: rangeMark.mode,
      },
    })
  }, [presence, rangeMark])
  // Piece key → time (s) of the last claim call of this browser, for the 0.2 s that a claim lasts
  const claimTimes = useRef(new Map())
  // The ownership that the models get: each claim sets the time of the claim
  const claims = useMemo(
    () =>
      ownership && {
        ...ownership,
        claim(key) {
          if (!ownership.claim(key)) return false
          claimTimes.current.set(key, performance.now() / 1000)
          return true
        },
      },
    [ownership],
  )
  // Claims the model before an action. False: the other player moves it, so the action does nothing.
  const claimModel = useCallback((id) => (claims ? claims.claim(modelKey(id)) : true), [claims])
  // Model id → frames until its body is put to sleep after a pose
  const sleepLater = useRef(new Map())
  // The newest poses, and the poses of the last render
  const posesRef = useRef(poses)
  const prevPoses = useRef(poses)
  // The set of the other player's claims of the last render
  const prevOther = useRef(otherOwned)
  // Ids of the models that show the overlap mark
  const [overlapIds, setOverlapIds] = useState(() => new Set())

  // Every model of every character, in spawn order (characters/models.js)
  const models = useMemo(() => characters.flatMap(characterModels), [characters])

  // Body position and base radius of every model with a body, except the one with id `skip`
  function modelBases(skip) {
    const list = []
    for (const model of models) {
      if (model.id === skip) continue
      const body = charBodies.current.get(model.id)
      if (!body) continue
      const t = body.translation()
      list.push({
        id: model.id,
        x: t.x,
        y: t.y,
        z: t.z,
        radius: BASE_DIAMETER[model.base] / 2,
      })
    }
    return list
  }

  // Every 100 ms: which models overlap. State changes only when the set changes.
  useEffect(() => {
    const id = setInterval(() => {
      const list = modelBases().map((m) => ({
        ...m,
        moved: moved.current.get(m.id) ?? 0,
      }))
      const marks = overlapMarks(list)
      setOverlapIds((prev) =>
        prev.size === marks.size && [...marks].every((m) => prev.has(m)) ? prev : marks,
      )
    }, OVERLAP_INTERVAL)
    return () => clearInterval(id)
    // modelBases only reads `models` and refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models])

  // Nearest character whose model (either one) or tray is under the client point (DOM pixels), or
  // null. Returns the character id.
  function characterAt(clientX, clientY) {
    const rect = gl.domElement.getBoundingClientRect()
    const ndc = {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1,
    }
    raycaster.current.setFromCamera(ndc, camera)
    let nearestId = null
    let nearestDistance = Infinity
    const targets = [
      // A construct is not a drop target: a token dropped on it lands on whatever is under it, the table
      // or the mat (docs/features/character-trays.md, "Constructs")
      ...models
        .filter((model) => !model.construct)
        .map((model) => [model.character.id, charObjects.current.get(model.id)]),
      ...characters.map((ch) => [ch.id, trayObjects.current.get(ch.id)]),
    ]
    for (const [id, object] of targets) {
      const hit = object && raycaster.current.intersectObject(object, true)[0]
      if (hit && hit.distance < nearestDistance) {
        nearestId = id
        nearestDistance = hit.distance
      }
    }
    return nearestId
  }

  // Id of the nearest terrain piece under the pointer, locked or not, or null. A locked piece gets no
  // pointer events (see Terrain.jsx), so this casts its own ray from the last pointer position. With
  // the pointer off the canvas (over the HUD or a tray's controls), it is null.
  function terrainAt() {
    if (!gl.domElement.matches(':hover')) return null
    return terrainUnder(pointer)
  }

  // Id of the nearest terrain piece on the ray through ndc, or null
  function terrainUnder(ndc) {
    raycaster.current.setFromCamera(ndc, camera)
    let nearestId = null
    let nearestDistance = Infinity
    for (const [id, object] of terrainObjects.current) {
      const hit = raycaster.current.intersectObject(object, true)[0]
      if (hit && hit.distance < nearestDistance) {
        nearestId = id
        nearestDistance = hit.distance
      }
    }
    return nearestId
  }

  // Hover label: with labels off, the piece under the pointer shows its label, locked or not. One ray
  // per frame at most, only on pointer move, and the state changes only when the id changes.
  const [hoverLabelId, setHoverLabelId] = useState(null)
  useEffect(() => {
    if (showLabels) {
      setHoverLabelId(null)
      return undefined
    }
    const canvas = gl.domElement
    let frame = 0
    let last = null
    function cast() {
      frame = 0
      const rect = canvas.getBoundingClientRect()
      const ndc = {
        x: ((last.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((last.clientY - rect.top) / rect.height) * 2 + 1,
      }
      setHoverLabelId(terrainUnder(ndc))
    }
    function onMove(e) {
      last = e
      if (!frame) frame = requestAnimationFrame(cast)
    }
    function onLeave() {
      cancelAnimationFrame(frame)
      frame = 0
      setHoverLabelId(null)
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    return () => {
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(frame)
      setHoverLabelId(null)
    }
    // terrainUnder only reads refs and the camera
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLabels, gl, camera])

  // Live table position of a character's first model (Hold and drop, "Drop"): the Rapier body when there
  // is one, otherwise the 3D object's own position. Not the spawn position, so a character that moved
  // drops its token where it now stands. Returns null if neither is mounted yet.
  function modelPosition(id) {
    const body = charBodies.current.get(id)
    if (body) {
      const t = body.translation()
      return { x: t.x, z: t.z }
    }
    const object = charObjects.current.get(id)
    if (object) {
      const p = object.getWorldPosition(new Vector3())
      return { x: p.x, z: p.z }
    }
    return null
  }

  // The pose of a mounted model to store: its body position and rotation, or null. A lifted model (R) gives
  // the place under the lift, so it stands there when the table opens again.
  function restPose(id) {
    const body = charBodies.current.get(id)
    if (!body) return null
    return poseOf(charLifts.current.get(id)?.restPosition() ?? body.translation(), body.rotation())
  }

  // on: the piece is now the hovered or dragged one (true), or no longer (false)
  function trackPiece(ref, piece, on) {
    if (on) ref.current = piece
    else if (ref.current?.kind === piece.kind && ref.current.id === piece.id) ref.current = null
  }

  // Q / E press, as in TTS: turns the dragged character or tool, else the one under the pointer, by
  // ROTATE_STEP around its center. direction: 1 counter-clockwise seen from above, -1 clockwise.
  // The dragged piece comes first, so a turn during a drag does not go to a piece that the
  // pointer passes over. A held key keeps turning the same piece, even when the pointer leaves it.
  function turnPiece(direction) {
    const piece = draggedPiece.current ?? hoveredPiece.current
    turnHold.current = { piece, time: 0 }
    if (piece) addTurn(piece, direction * ROTATE_STEP)
  }

  // Adds angle to the turn of the piece that is not done yet
  function addTurn(piece, angle) {
    // A model turn claims the model. A tool turn claims nothing.
    if (piece.kind === 'character' && !claimModel(piece.id)) return
    const key = `${piece.kind}:${piece.id}`
    const turn = turnsLeft.current.get(key)
    if (turn) turn.left += angle
    else turnsLeft.current.set(key, { piece, left: angle })
  }

  // Turns the piece by angle at once. Does nothing for a piece that is gone.
  function applyTurn(piece, angle) {
    if (piece.kind === 'tool') toolTurns.current[piece.id]?.(angle)
    if (piece.kind === 'character') {
      const body = charBodies.current.get(piece.id)
      if (body) turnBody(body, angle)
    }
  }

  // A held Q / E adds to the turn of its piece. Then every piece with a turn left does a part of it.
  useFrame((_, dt) => {
    let direction = 0
    for (const d of heldRotate.current.values()) direction += d
    const hold = turnHold.current
    hold.time += dt
    if (hold.piece && direction !== 0 && hold.time > ROTATE_HOLD_DELAY)
      addTurn(hold.piece, direction * ROTATE_RATE * dt)
    const part = 1 - Math.exp(-dt / ROTATE_SMOOTH_TIME)
    for (const [key, turn] of turnsLeft.current) {
      const angle = Math.abs(turn.left) < ROTATE_DONE ? turn.left : turn.left * part
      turn.left -= angle
      applyTurn(turn.piece, angle)
      if (turn.left === 0) turnsLeft.current.delete(key)
    }
  })

  // Puts a model body at a stored pose: dynamic, exact, and asleep a few frames later (decision 8)
  function applyPose(id, pose) {
    const body = charBodies.current.get(id)
    if (!body) return
    body.setBodyType(0, true)
    body.setTranslation({ x: pose.x, y: pose.y, z: pose.z }, true)
    body.setRotation({ x: pose.qx, y: pose.qy, z: pose.qz, w: pose.qw }, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    sleepLater.current.set(id, SLEEP_AFTER_FRAMES)
  }

  // The claim check of the own model claims (decision 5), and the bodies that wait to sleep. A claim ends
  // when the body is dynamic and asleep and nothing of this browser moves the model. The rest pose goes
  // to the document first, then the release, so the other browser gets the pose first.
  useFrame(() => {
    for (const [id, frames] of sleepLater.current) {
      if (frames > 1) {
        sleepLater.current.set(id, frames - 1)
        continue
      }
      sleepLater.current.delete(id)
      const body = charBodies.current.get(id)
      if (body?.isDynamic() && ownership?.owner(modelKey(id)) !== 'other') body.sleep()
    }
    if (!ownership) return
    const now = performance.now() / 1000
    for (const key of ownership.mine()) {
      const id = modelIdOfKey(key)
      if (id === null) continue
      const body = charBodies.current.get(id)
      const action = claimCheck({
        age: now - (claimTimes.current.get(key) ?? -Infinity),
        dynamic: body?.isDynamic() ?? false,
        asleep: body?.isSleeping() ?? false,
        busy: Boolean(charLifts.current.get(id)?.isBusy()) || turnsLeft.current.has(key),
        gone: !body || !models.some((model) => model.id === id),
      })
      if (action === 'keep') continue
      if (action === 'rest') {
        const rest = restPose(id)
        if (rest) onModelRest?.(id, rest)
      }
      claimTimes.current.delete(key)
      ownership.release(key)
    }
  })

  // A lost tie (decision 7): a turn left for that model is removed. The drag and lift stop in the
  // model (CharacterModel.jsx, remote).
  useEffect(() => ownership?.onLost((key) => turnsLeft.current.delete(key)), [ownership])

  useEffect(() => {
    posesRef.current = poses
  })

  // Rest poses from the other browser (decision 8). A model that nobody claims, with a changed pose that
  // the body does not stand at: the body goes there. A pose that this browser wrote equals the body.
  // A model that this browser claims ignores it. A model that the other player claims waits (below).
  useEffect(() => {
    const prev = prevPoses.current
    prevPoses.current = poses
    if (prev === poses) return
    for (const model of models) {
      const entry = poses[model.id]
      if (!entry || samePose(entry, prev[model.id])) continue
      if (ownership?.owner(modelKey(model.id)) != null) continue
      const body = charBodies.current.get(model.id)
      if (!body || samePose(poseOf(body.translation(), body.rotation()), entry)) continue
      applyPose(model.id, entry)
    }
    // applyPose and models only read refs and the models of this render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poses])

  // The other player's claims start and end (decisions 1, 8, 9)
  useEffect(() => {
    const present = ownership?.otherPresent() ?? false
    const { started, ended, gone } = claimChanges(prevOther.current, otherOwned, present)
    prevOther.current = otherOwned
    for (const key of started) {
      const id = modelIdOfKey(key)
      if (id !== null) markMoved(id)
    }
    for (const key of ended) {
      const id = modelIdOfKey(key)
      if (id === null || ownership.owner(key) === 'me') continue
      const pose = posesRef.current[id]
      if (pose) applyPose(id, pose)
      else charBodies.current.get(id)?.setBodyType(0, true)
    }
    // The other player is gone: the body stays where it is and awake. This browser writes its rest pose.
    for (const key of gone) {
      const id = modelIdOfKey(key)
      const body = id === null ? null : charBodies.current.get(id)
      if (body && ownership.owner(key) !== 'me') {
        body.setBodyType(0, true)
        body.wakeUp()
      }
    }
    // applyPose and markMoved only read refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherOwned])

  // R press: lifts the character under the pointer, or puts it back down if it is up. With no
  // character under the pointer, every lifted character goes back down. A player lifts a model to
  // see and select a token under it (docs/features/crisis.md, "Models that cover a token").
  function liftPiece() {
    const piece = hoveredPiece.current
    if (piece?.kind === 'character') {
      if (claimModel(piece.id)) charLifts.current.get(piece.id)?.toggle()
    } else {
      // Putting down a lift needs no new claim: it is an own lift. A model of the other player has none.
      for (const [id, lift] of charLifts.current) {
        if (ownership?.owner(modelKey(id)) !== 'other') lift.down()
      }
    }
  }

  // R press during a model drag: switches the floor of the dragged model. Returns the HUD message.
  function floorPiece() {
    const id = modelDragRef?.current
    return id == null ? null : charLifts.current.get(id)?.toggleFloor?.()
  }

  // Remove button on the tray (docs/features/round-phases.md, decision 16): every model of the character
  // goes back to its place on the tray, upright, so the model turns as it did at its spawn. A model that
  // the other player moves is skipped. y = 0 is the rest height: the card has no collider and the table
  // top is y = 0, the same as at the spawn, so the sleeping body touches only the table. A lift ends
  // (cancel) and does not animate down, which would move the body back to the place before the lift.
  // The pose goes to the document at once, the same as a rest. The other browser waits for the claim of
  // this one to end, then applies it (the otherOwned effect); with no claim it applies it at once.
  function returnModels(characterId) {
    for (const model of models) {
      if (model.character.id !== characterId || !charBodies.current.has(model.id)) continue
      if (!claimModel(model.id)) continue
      charLifts.current.get(model.id)?.cancel()
      turnsLeft.current.delete(modelKey(model.id))
      const [x, y, z] = trayPlace(model)
      const pose = poseOf({ x, y, z }, yawQuaternion(modelSpawnYaw(model.character.team)))
      applyPose(model.id, pose)
      onModelRest?.(model.id, pose)
    }
  }

  // Props of a tool ('range', 'move', 'angle' or 'los') for turnPiece
  function turnProps(tool) {
    const piece = { kind: 'tool', id: tool }
    return {
      onHover: (over) => trackPiece(hoveredPiece, piece, over),
      onDrag: (on) => trackPiece(draggedPiece, piece, on),
      turnRef: (turn) => {
        toolTurns.current[tool] = turn
      },
      liveRef: (get) => {
        toolLives.current[tool] = get
      },
    }
  }

  // Registered on every render, so the closures above always see the latest characters/objects.
  useEffect(() => {
    if (characterAtRef) characterAtRef.current = characterAt
    if (modelPositionRef) modelPositionRef.current = modelPosition
    if (turnPieceRef) turnPieceRef.current = turnPiece
    if (liftPieceRef) liftPieceRef.current = liftPiece
    if (floorPieceRef) floorPieceRef.current = floorPiece
    if (returnModelsRef) returnModelsRef.current = returnModels
    if (terrainAtRef) terrainAtRef.current = terrainAt
  })

  // Tray position of every character (trays.js). A player's row recenters when that player adds
  // or removes a character, so these positions change then.
  const trayPositions = useMemo(() => layoutTrays(characters), [characters])
  // The grunts of each host (a grunt's card lies on its host's tray)
  const gruntLists = useMemo(() => gruntsByHost(characters), [characters])
  const trayShape = (ch) => trayShapeOf(ch, characters, gruntLists)
  // Tray positions of the last layout, to find the trays that moved.
  const lastTrayPositions = useRef(new Map())
  // A model that still stands on its tray moves with the tray, the same as TTS (moveTray in the
  // tray script). A model that the player moved off its tray, for example onto the mat, stays. A
  // spare model past the Give sources (Hulkbuster's Iron Man) counts as on the tray (inTrayArea).
  useEffect(() => {
    for (const model of models) {
      const { id: characterId, team } = model.character
      const pos = trayPositions.get(characterId)
      const last = lastTrayPositions.current.get(characterId)
      const body = charBodies.current.get(model.id)
      if (!pos || !last || !body || (last[0] === pos[0] && last[2] === pos[2])) continue
      // The other player moves this model: its pose comes from the other browser
      if (ownership?.owner(modelKey(model.id)) === 'other') continue
      const t = body.translation()
      if (inTrayArea(team, last, t, trayShapeOf(model.character, characters, gruntLists).grunts))
        body.setTranslation({ x: t.x + pos[0] - last[0], y: t.y, z: t.z + pos[2] - last[2] }, true)
    }
    lastTrayPositions.current = trayPositions
  }, [trayPositions])

  // Model id of the selected model. Its character's tray card shows the selection too.
  const selectedModelId = selectedId(selection, 'character')
  const selectedCharId = selectedModelId && modelCharacterId(selectedModelId)
  const selectedTokenId = selectedId(selection, 'token')
  const selectedTerrainId = selectedId(selection, 'terrain')

  // Deploy-line: R3 zone depth from the deployment edge
  const deployTip = RANGE_TIP[3]
  const deployDepth = 2 * deployTip
  const draggingChar =
    deployLine && draggingCharId
      ? models.find((model) => model.id === draggingCharId)?.character
      : null
  // The other player's drag: the model, if Deploy Lock is on and they own its key
  const otherDragId = deployLine && otherDragKey ? modelIdOfKey(otherDragKey) : null
  const otherDragModel =
    otherDragId !== null && ownership?.owner(otherDragKey) === 'other'
      ? models.find((model) => model.id === otherDragId)
      : null
  const otherDragChar = otherDragModel?.character ?? null

  // Every character and every mat token as the range and movement tools see them. A character has a
  // Rapier body; a token does not, so getCenter (not getBody) is what the tools measure with.
  // getBody is only used where a tool moves a piece (Place, Throw), and both are disabled for a token.
  // isLifted is for a Throw: a lifted character does not stop it.
  // A held token is not in this list: it is off the mat, on its holder's tray (see "Hold and drop").
  const matTokens = useMemo(() => tokens.filter((tok) => !tok.heldBy), [tokens])
  // For the spectator view: the tokens of the Secure card on the mat, and the held tokens of each
  // character, in the order it took them
  const secureTokens = useMemo(
    () => matTokens.filter((tok) => tok.cardKey === crisis.secure),
    [matTokens, crisis.secure],
  )
  const heldTokens = useMemo(() => heldTokensByCharacter(tokens), [tokens])
  // Every crisis token as it is drawn. A held token lies on its holder's card: its tray-local place
  // (heldAt) moves to the table with the tray position, and it faces the holder's player, the same
  // as the card (see trays.js, "An objective token that the character holds").
  const tokenViews = useMemo(() => {
    const stacks = new Map()
    return tokens.map((tok) => {
      if (!tok.heldBy) return { token: tok }
      const holder = characters.find((ch) => ch.id === tok.heldBy)
      const trayPos = trayPositions.get(tok.heldBy)
      if (!holder || !trayPos) return { token: tok }
      // A grunt's token lies on the grunt card (the default place is on a host card, so it is clamped)
      const { slot } = trayShapeOf(holder, characters, gruntLists)
      const local = holder.host ? trayGruntHeldClamp(tok.heldAt) : tok.heldAt
      const [x, z] = trayHeldWorld(holder.team, trayPos, local, slot)
      const level = stacks.get(tok.heldBy) ?? 0
      stacks.set(tok.heldBy, level + 1)
      return {
        token: { ...tok, x, z, yaw: trayYaw(holder.team) },
        floorY: TRAY_Y + level * HELD_STACK_STEP,
      }
    })
  }, [tokens, characters, trayPositions, gruntLists])
  const toolModels = useMemo(
    () => [
      ...models.map((model) => ({
        kind: 'character',
        id: model.id,
        getBody: () => charBodies.current.get(model.id),
        getObject: () => charObjects.current.get(model.id),
        getCenter: () =>
          charBodies.current.get(model.id)?.translation() ?? {
            x: 0,
            y: 0,
            z: 0,
          },
        isLifted: () => charLifts.current.get(model.id)?.isUp() ?? false,
        // For the Line of Sight tool: the name, and the Size of the side that faces up
        name: characterName(model.character.key),
        size: () => characterSize(model.character.key, model.character.side),
        claim: () => claimModel(model.id),
        moved: () => markMoved(model.id),
        radius: BASE_DIAMETER[model.base] / 2,
      })),
      ...matTokens.map((tok) => ({
        kind: 'token',
        id: tok.id,
        getObject: () => tokenObjects.current.get(tok.id),
        getCenter: () => tokenCenters.current.get(tok.id)?.() ?? { x: tok.x, y: 0, z: tok.z },
        radius: 0.5,
      })),
    ],
    [models, matTokens, claimModel],
  )
  const toolModel = (piece) =>
    toolModels.find((model) => piece && model.kind === piece.kind && model.id === piece.id) ?? null
  // The spawn target of the range and movement tools. undefined without one, so that RulerTool falls back
  // to target (null would mean "spawn free").
  const spawnModel = (piece) => (piece ? toolModel(piece) : undefined)
  // The tools measure against the character or token selected last, and a new tool snaps to it.
  // Place moves the selected character, also when a token was selected after it.
  const toolTarget = toolModel(selection.findLast(isToolPiece))
  const otherSide = ownSide === 'guest' ? 'host' : 'guest'
  const sideColors = useSideColors()
  const ownTools = tools[ownSide] ?? {}
  const otherTools = tools[otherSide] ?? {}
  // Props that every own tool gets from its entry
  const toolKey = (kind, entry) => `${kind}-${entry.which}-${entry.spawn}`
  const toolEntry = (kind) => ({
    team: ownSide,
    side: ownSide,
    entry: ownTools[kind],
    onStore: (fields) => onToolStore?.(kind, ownTools[kind].spawn, fields),
    onReturn: onToolReturn && (() => onToolReturn(kind)),
  })

  // Outline mode of the range mark on a piece, or null
  // The own mark wins over the other player's (decision 24)
  function rangeMarkOf(kind, id) {
    if (rangeMark?.kind === kind && rangeMark.id === id) return rangeMark.mode
    return otherLook.mark?.key === `${kind}:${id}` ? otherLook.mark.mode : null
  }
  // The color of the other player who has the piece selected, or null
  function otherSelectedOf(kind, id) {
    return otherLook.selection.includes(`${kind}:${id}`) ? sideColors[otherSide] : null
  }
  // The other player's tool target: the last key of their selection, as a tool model
  const otherKey = otherLook.selection.at(-1)
  const otherTarget = otherKey
    ? (toolModels.find((model) => `${model.kind}:${model.id}` === otherKey) ?? null)
    : null

  // The open direction of the angle tool when it is snapped to model, else null. A movement tool snapped
  // to the same character points within 45° of it.
  function angleLimit(model) {
    const angle = angleTool.current?.()
    return angle && sameModel(angle.target, model) ? angle.openYaw : null
  }

  // Table position where a model spawns: its saved pose in a room, else on its card on the tray, or for
  // a spare model (a second form without its own card), past the Give sources (trays.js). The model
  // reads it only once, when its body mounts.
  function modelSpawnPosition(model) {
    const pose = startPose?.(model.id)
    if (pose) return [pose.x, pose.y, pose.z]
    return trayPlace(model)
  }

  // The turn a model starts with, no stored pose: it faces the mat (characters/models.js, modelSpawnYaw)
  function startQuaternion(team) {
    const { x, y, z, w } = yawQuaternion(modelSpawnYaw(team))
    return [x, y, z, w]
  }

  // Where a model stands on its tray: on its card, or for a spare model past the Give sources
  function trayPlace(model) {
    const ch = model.character
    const trayPos = trayPositions.get(ch.id)
    const { grunts, index } = trayShape(ch)
    if (ch.host) return trayGruntModelPosition(ch.team, trayPos, trayShape(ch).cards, index)
    if (model.card) return trayModelPosition(ch.team, trayPos, model.card)
    const giveCount = characterGiveSources(ch.key).length
    if (!model.construct)
      return traySpareModelPosition(
        ch.team,
        trayPos,
        trayCards(ch),
        giveCount,
        BASE_DIAMETER[model.base] / 2,
        grunts,
      )
    // The constructs lie in a row past the spare model, when the character has one
    const all = characterModels(ch)
    const spare = all.find((m) => m.card === null && !m.construct)
    return trayConstructPosition(
      ch.team,
      trayPos,
      trayCards(ch),
      giveCount,
      spare ? BASE_DIAMETER[spare.base] / 2 : 0,
      all.filter((m) => m.construct).findIndex((m) => m.id === model.id),
      BASE_DIAMETER[model.base] / 2,
      grunts,
    )
  }

  // The spectator view above a model of a character, or undefined when it is off. The model draws
  // it, so it moves with the model (CharacterModel.jsx, overlay). Both models of a
  // character with a second form show it.
  function spectatorOverlay(model) {
    if (!spectator || model.construct) return undefined
    const ch = model.character
    return (top) => (
      <SpectatorBadge
        character={ch}
        stamina={characterStamina(ch.key, ch.side)}
        top={top}
        baseRadius={BASE_DIAMETER[model.base] / 2}
        held={heldTokens.get(ch.id)}
        secureTokens={secureTokens}
      />
    )
  }

  function toggleTool(tool) {
    onSelectedToolsChange((prev) => ({ ...prev, [tool]: !prev[tool] }))
  }

  function selectTool(tool) {
    onSelectedToolsChange((prev) => ({ ...prev, [tool]: true }))
  }

  // A drag selects the piece and keeps it selected, a click toggles (toggleSelect)
  function dragSelect(kind, id) {
    onSelectionChange((prev) => selectPiece(prev, { kind, id }))
  }

  function toggleSelect(kind, id) {
    onSelectionChange((prev) => toggleSelectPiece(prev, { kind, id }))
  }

  // A tool snapped to model. It does not select a model of a side this browser does not play.
  function selectModel(model) {
    const piece = { kind: model.kind, id: model.id }
    if (!toolSelects(piece, characters, playedSides)) return
    onSelectionChange((prev) => selectPiece(prev, piece))
  }

  return (
    <>
      {/* Background image. The dark color shows while the image loads. */}
      <Suspense fallback={<color attach="background" args={['#050510']} />}>
        <Backdrop />
      </Suspense>

      <SceneLights />

      <Physics gravity={[0, WORLD_GRAVITY, 0]} timeStep={TIME_STEP} debug={showColliders}>
        <ToolPoint pointRef={toolPointRef} />
        {ownPing && <Ping key={ownPing.id} ping={ownPing} side={ownSide} />}
        {otherLook.ping && (
          <Ping
            key={otherLook.ping.id}
            ping={otherLook.ping}
            side={ownSide === 'guest' ? 'host' : 'guest'}
          />
        )}
        {live && ownership && (
          <>
            <LiveSync
              live={live}
              ownership={ownership}
              getBody={(id) => charBodies.current.get(id)}
              toolLives={toolLives}
              diceLives={diceLives}
              pieceLives={pieceLives}
              liveRef={received}
              hideCursor={Boolean(squadEdit?.[ownSide])}
            />
            <RemoteCursor
              liveRef={received}
              ownership={ownership}
              side={ownSide === 'guest' ? 'host' : 'guest'}
            />
          </>
        )}
        <TableSurface />
        {/* Invisible walls at the table edge, so dice cannot fall off the table. Kinematic, see table.js. */}
        <RigidBody type="kinematicPosition" colliders={false}>
          {TABLE_WALLS.map(({ halfExtents, position }, i) => (
            <CuboidCollider key={i} args={halfExtents} position={position} friction={FRICTION} />
          ))}
        </RigidBody>

        {/* The mat and its terrain turn together around the mat center. In game setup, the player with priority
            turns them so that the deployment edge they chose faces their side (GameSetup.jsx). */}
        <group rotation={[0, (matTurns * Math.PI) / 2, 0]}>
          <Suspense fallback={null}>
            <Mat mat={MAPS[mapId].mat} rotation={MAPS[mapId].matRotation} />
          </Suspense>
          {/* A fixed body does not follow its parent after it is created. So each turn mounts the terrain again,
              and its colliders are created at the new pose. A new map also mounts it again. */}
          <Suspense key={`${mapId}-${matTurns}`} fallback={null}>
            <Terrain
              placements={terrain}
              showLabels={showLabels}
              hoverLabelId={hoverLabelId}
              selectedId={selectedTerrainId}
              onSelect={(id) => toggleSelect('terrain', id)}
              onHover={onTerrainHover}
              objectRef={(id, obj) =>
                obj ? terrainObjects.current.set(id, obj) : terrainObjects.current.delete(id)
              }
            />
          </Suspense>
        </group>

        {/* Dice trays are relative to the table, not the mat: not keyed by mapId or matTurns, so a
            map change or a mat turn (which remounts Terrain above) never remounts them and their
            dice keep their state. See docs/plans/dice-rolling.md, Phase 4. */}
        {Object.keys(TRAYS).map((trayKey) =>
          playedSides.includes(trayKey) ? (
            <DiceTray
              key={trayKey}
              trayKey={trayKey}
              store={diceStore}
              rolls={rollsStore}
              transact={transact}
              diceLives={diceLives}
              openDieId={diceMenu?.trayKey === trayKey ? diceMenu.dieId : null}
              onDieOpen={(dieId) => onDiceMenuOpen(trayKey, dieId)}
              onMenuClose={onDiceMenuClose}
              onHover={(over) => onDiceTrayHover?.(trayKey, over)}
              addRef={
                addDiceRef
                  ? (add) => {
                      if (add) addDiceRef.current[trayKey] = add
                      else delete addDiceRef.current[trayKey]
                    }
                  : undefined
              }
            />
          ) : (
            <OtherDiceTray key={trayKey} trayKey={trayKey} store={diceStore} liveRef={received} />
          ),
        )}

        {/* The scoring board is relative to the table, the same as the dice trays */}
        <ScoreBoard
          markers={scoreMarkers}
          affiliations={affiliations}
          onMarkerMove={onScoreMarkerMove}
          ownership={ownership}
          pieceLives={pieceLives}
          otherOwned={otherOwned}
          getLivePose={getPieceLive}
        />
        <PriorityMarker priority={priority} title={priorityTitle} onClick={onPriorityClick} />

        {/* Crisis cards and tokens are relative to the player sides, not the mat, so they stay
            outside the rotating group above: a mat turn must not turn them. See docs/features/crisis.md. */}
        {crisis.secure && (
          <Suspense fallback={null}>
            <CrisisCard
              cardKey={crisis.secure}
              position={[CARD_X, CARD_Y, CARD_Z.secure]}
              onOpen={onCardOpen}
              onCardHover={onCardHover}
            />
          </Suspense>
        )}
        {crisis.extract && (
          <Suspense fallback={null}>
            <CrisisCard
              cardKey={crisis.extract}
              position={[CARD_X, CARD_Y, CARD_Z.extract]}
              onOpen={onCardOpen}
              onCardHover={onCardHover}
            />
          </Suspense>
        )}
        {/* The supply pile of a Source card (only Extract cards have one now) */}
        {Object.entries(crisis).map(([type, key]) => {
          const supply = getCard(key)?.supply
          return (
            supply && (
              <SupplyPile
                key={type}
                tokenKey={supply}
                position={supplyPilePosition(type)}
                onDragStart={(e) => onSupplyDragStart(e, key)}
              />
            )
          )
        })}
        {/* A held token lies on its holder's tray card (Hold and drop). A drag off the card puts
            it back on the mat (onMove). It is not a piece for the tools, so its hover goes to
            onHeldHover, not onPieceHover: a tool key over it does not snap a tool to it (App.jsx,
            handleToolKey), and the Delete key removes it. */}
        {tokenViews.map(({ token: tok, floorY }) => (
          <Suspense key={tok.id} fallback={null}>
            <CrisisToken
              token={tok}
              floorY={floorY}
              selected={selectedTokenId === tok.id}
              rangeMark={rangeMarkOf('token', tok.id)}
              otherSelected={otherSelectedOf('token', tok.id)}
              onSelect={() => toggleSelect('token', tok.id)}
              onDragSelect={() => dragSelect('token', tok.id)}
              onHover={
                tok.heldBy
                  ? (over) => onHeldHover?.(tok.id, over)
                  : (over) => onPieceHover?.({ kind: 'token', id: tok.id }, over)
              }
              canDrag={!tok.placeBy || playedSides.includes(tok.placeBy)}
              constrainDrag={tok.placeBy ? (p) => clampWaiting(tok, p, TOKEN_RADIUS) : null}
              onMove={(x, z) => onTokenMove(tok.id, x, z)}
              onTurn={(yaw) => onTokenTurn(tok.id, yaw)}
              ownership={ownership}
              pieceLives={pieceLives}
              remote={otherOwned.has(`token:${tok.id}`)}
              getLivePose={getPieceLive}
              onHold={(characterId, point) => {
                const holder = characters.find((ch) => ch.id === characterId)
                const trayPos = trayPositions.get(characterId)
                const shape = holder && trayShape(holder)
                const onCard =
                  holder &&
                  trayPos &&
                  onTray(holder.team, trayPos, point, shape.cards, shape.grunts)
                onTokenHold(
                  tok.id,
                  characterId,
                  onCard
                    ? holder.host
                      ? trayGruntHeldLocal(holder.team, trayPos, point, shape.slot)
                      : trayHeldLocal(holder.team, trayPos, point)
                    : null,
                )
              }}
              findCharacter={findCharacterAt}
              controlAffiliation={tok.control ? affiliations[tok.control] : null}
              objectRef={(obj) =>
                obj ? tokenObjects.current.set(tok.id, obj) : tokenObjects.current.delete(tok.id)
              }
              centerRef={(fn) =>
                fn ? tokenCenters.current.set(tok.id, fn) : tokenCenters.current.delete(tok.id)
              }
            />
          </Suspense>
        ))}

        {/* Character tokens on the table. Relative to the table, not the mat, the same as the crisis
            tokens above. A token that is being dragged shows under the pointer instead. */}
        {looseTokens.map((tok, index) =>
          tokenDrag?.active && tokenDrag.looseId === tok.id ? null : (
            <LooseToken
              key={tok.id}
              token={tok}
              index={index}
              count={
                (tok.count ?? 1) - (tokenDrag?.active && tokenDrag.takeFrom === tok.id ? 1 : 0)
              }
              onDragStart={(e) => onTokenDragStart(e, tok.key, tok.id)}
              onHover={(over) => onLooseHover?.(tok.id, over)}
              remote={otherOwned.has(`loose:${tok.id}`)}
              getLivePose={getPieceLive}
            />
          ),
        )}
        {/* Piles of character tokens on the table (Library, Pile mode). A pile that is moved shows
            under the pointer instead. */}
        {tokenPiles
          .filter((pile) => !(tokenDrag?.active && tokenDrag.pileId === pile.id))
          .map((pile) => (
            <TokenPile
              key={pile.id}
              pile={pile}
              onTakeStart={(e) => onPileTakeStart(e, pile)}
              onMoveStart={(e) => onPileMoveStart(e, pile)}
              onHover={(over) => onPileHover?.(pile.id, over)}
              remote={otherOwned.has(`pile:${pile.id}`)}
              getLivePose={getPieceLive}
            />
          ))}
        {tokenDrag?.active && (
          <TokenDragPreview
            pointRef={dragPointRef}
            start={tokenDrag.start}
            stacks={!tokenDrag.supplyCard && !tokenDrag.pile && !tokenDrag.pileId}
          >
            {tokenDrag.supplyCard ? (
              <SupplyToken tokenKey={tokenDrag.tokenKey} raycast={NO_RAYCAST} />
            ) : tokenDrag.pile || tokenDrag.pileId ? (
              <PileStack tokenKey={tokenDrag.tokenKey} interactive={false} />
            ) : (
              <TokenFace
                tokenKey={tokenDrag.tokenKey}
                size={tokenSize(tokenDrag.tokenKey)}
                interactive={false}
              />
            )}
          </TokenDragPreview>
        )}
        {/* The new piece that the other player drags: the kind comes from the key (decision 22) */}
        {otherSpawn && (
          <OtherSpawnPreview
            key={otherSpawn.key}
            spawnKey={otherSpawn.key}
            tokenKey={otherSpawn.tokenKey}
            getLivePose={getPieceLive}
            stacks={otherSpawn.key.startsWith('loose:')}
          >
            {otherSpawn.key.startsWith('token:') ? (
              <SupplyToken tokenKey={otherSpawn.tokenKey} raycast={NO_RAYCAST} />
            ) : otherSpawn.key.startsWith('pile:') ? (
              <PileStack tokenKey={otherSpawn.tokenKey} interactive={false} />
            ) : (
              <TokenFace
                tokenKey={otherSpawn.tokenKey}
                size={tokenSize(otherSpawn.tokenKey)}
                interactive={false}
              />
            )}
          </OtherSpawnPreview>
        )}

        {/* The tactic tray of each player, between the mat and the character trays, and the Team
            Tactic cards. Relative to the table, not the mat. See docs/features/team-tactic-cards.md. */}
        {/* Power Phase and the board strip of each player (docs/features/table-tools.md) */}
        <TableButtons ownSide={ownSide} {...tableButtons} />
        {/* The tool rack of each player (docs/features/table-tools.md, "Tool rack") */}
        {toolRack && (
          <ToolRack
            ownSide={ownSide}
            tools={tools}
            hiddenSides={rackHiddenSides(setup, rosters)}
            {...toolRack}
          />
        )}
        {toolDrag?.active && (
          <ToolDragGhost
            pointRef={toolDragPointRef}
            start={toolDrag.start}
            kind={toolDrag.kind}
            which={toolDrag.which}
            side={ownSide}
          />
        )}
        <TacticTray team="host" />
        <TacticTray team="guest" />
        {/* The loaded rosters, in the area of the character trays (docs/features/roster.md), until the squads
            go on the table (the steps before 'affiliation'). Locked cards, no physics body, so a tool or a
            model passes over them. The crisis cards of the rosters and the setup buttons are in
            GameSetup. */}
        {rosterRowsShown(setup) &&
          ['host', 'guest'].map(
            (team) =>
              rosters[team] && (
                <RosterCards
                  key={team}
                  team={team}
                  code={rosters[team].code}
                  squad={
                    setupStep(setup) === 'squads' && !viewOf(setup) ? setup.squads[team] : undefined
                  }
                  onOpen={(tab, index) => onRosterOpen?.({ team, tab, index })}
                  onGemOpen={onAttachedOpen}
                  onToggle={
                    squadEdit?.[team]
                      ? (tab, index) => onSquadToggle?.(team, tab, index)
                      : undefined
                  }
                  onCardHover={onCardHover}
                />
              ),
          )}
        <GameSetup
          setup={setup}
          rosters={rosters}
          mySide={mySide}
          seatPlayers={seatPlayers}
          actions={setupActions}
          onCrisisOpen={onCrisisOpen}
          onCardHover={onCardHover}
        />
        {tacticCards.map((card, i) => (
          <Suspense key={card.id} fallback={null}>
            <TacticCard
              card={card}
              stackIndex={i}
              onMove={(x, z) => onTacticMove(card.id, x, z)}
              ownership={ownership}
              pieceLives={pieceLives}
              remote={otherOwned.has(`tactic:${card.id}`)}
              getLivePose={getPieceLive}
              onOpen={onCardOpen}
              onHover={(over) => onTacticHover?.(card.id, over)}
              onCardHover={onCardHover}
            />
          </Suspense>
        ))}

        {/* One tray per spawned character, next to the mat edge (see trays.js and
            docs/features/character-trays.md, "Tray layout"). The models below spawn standing on the center
            of this tray's cards (modelSpawnPosition). A model reads that position only once, when
            its body mounts, so a later tray move does not teleport it. */}
        {characters
          .filter((ch) => trayPositions.has(ch.id))
          .map((ch) => (
            <Suspense key={ch.id} fallback={null}>
              <CharacterTray
                character={ch}
                position={trayPositions.get(ch.id)}
                grunts={ch.host ? 0 : trayShape(ch).grunts}
                slot={trayShape(ch).slot}
                onOpen={() => onTrayOpen(ch.id)}
                onDamage={(damage) => onCharacterDamage(ch.id, damage)}
                onPower={(power) => onCharacterPower(ch.id, power)}
                onFlip={() => onCharacterFlip(ch.id)}
                onCardHover={(over) => onTrayCardHover?.(ch.id, over)}
                onCardImageHover={onCardHover}
                onRemove={() => onCharacterOffBoard(ch.id)}
                onBoard={characterOnBoard(ch, poses)}
                removeWait={removeWaits[ch.id] ?? null}
                onAttachedOpen={onAttachedOpen}
                onTokenRemove={(key) => onCharacterTokenRemove(ch.id, key)}
                onTokenDragStart={onTokenDragStart}
                selected={selectedCharId === ch.id}
                objectRef={(obj) =>
                  obj ? trayObjects.current.set(ch.id, obj) : trayObjects.current.delete(ch.id)
                }
              />
            </Suspense>
          ))}

        {models.map((model) => {
          const ch = model.character
          // The same props for a 3D model and a standee (CharacterModel.jsx)
          const pose = startPose?.(model.id)
          const props = {
            position: modelSpawnPosition(model),
            quaternion: pose ? [pose.qx, pose.qy, pose.qz, pose.qw] : startQuaternion(ch.team),
            baseRadius: BASE_DIAMETER[model.base] / 2,
            rotation: [0, modelFigureYaw(model), 0],
            team: ch.team,
            selected: selectedModelId === model.id,
            rangeMark: rangeMarkOf('character', model.id),
            otherSelected: otherSelectedOf('character', model.id),
            overlap: overlapIds.has(model.id),
            overlapsAt: (x, y, z) =>
              overlapsAny({ x, y, z, radius: BASE_DIAMETER[model.base] / 2 }, modelBases(model.id)),
            onSelect: () => toggleSelect('character', model.id),
            onDragSelect: () => dragSelect('character', model.id),
            onHover: (over) => {
              onPieceHover?.({ kind: 'character', id: model.id }, over)
              trackPiece(hoveredPiece, { kind: 'character', id: model.id }, over)
              // A construct has no card
              if (!model.construct)
                onCardHover?.(
                  {
                    src: assetUrl(modelCardFile(model)),
                    alt: characterName(ch.key),
                    by: `model:${model.id}`,
                  },
                  over,
                )
            },
            bodyRef: (rb) =>
              rb ? charBodies.current.set(model.id, rb) : charBodies.current.delete(model.id),
            claimKey: modelKey(model.id),
            ownership: claims,
            remote: otherOwned.has(modelKey(model.id)),
            otherDragging: otherDragKey === modelKey(model.id),
            getLivePose: getPieceLive,
            getLiveTime: getPieceLiveTime,
            onRest: () => {
              // One writer for each rest pose (decision 6)
              if (ownership && !ownership.writes(modelKey(model.id))) return
              const rest = restPose(model.id)
              if (rest) onModelRest?.(model.id, rest)
            },
            objectRef: (obj) =>
              obj ? charObjects.current.set(model.id, obj) : charObjects.current.delete(model.id),
            liftRef: (lift) =>
              lift ? charLifts.current.set(model.id, lift) : charLifts.current.delete(model.id),
            onDragStart: () => {
              markMoved(model.id)
              setDraggingCharId(model.id)
              ownership?.setDrag(modelKey(model.id))
              if (modelDragRef) modelDragRef.current = model.id
              trackPiece(draggedPiece, { kind: 'character', id: model.id }, true)
            },
            // cancelled: Esc put the body back, so a Q / E turn that is not done yet is dropped
            onDragEnd: (cancelled) => {
              if (cancelled) turnsLeft.current.delete(modelKey(model.id))
              setDraggingCharId(null)
              ownership?.setDrag(null)
              if (modelDragRef?.current === model.id) modelDragRef.current = null
              trackPiece(draggedPiece, { kind: 'character', id: model.id }, false)
            },
            // A base is within range if any part of it is within range (p8). So the base can
            // go as far as touching the far end of the tool: its center is one radius past it.
            constrainDrag: (p) => {
              if (deployLine) {
                const limit = MAT_SIZE / 2 - deployDepth - BASE_DIAMETER[model.base] / 2
                if (ch.team === 'host') p.z = Math.max(p.z, limit)
                else p.z = Math.min(p.z, -limit)
              }
              // The limits take the tool form (getCenter, radius), not the raw model.
              const toolModel = toolModels.find((m) => m.kind === 'character' && m.id === model.id)
              for (const limit of Object.values(placeLimits.current)) {
                if (toolModel && limit?.owns(toolModel, p)) limit.clamp(p, toolModel)
              }
            },
            overlay: spectatorOverlay(model),
          }
          const urls = modelUrls(model)
          return (
            <Suspense key={model.id} fallback={null}>
              {urls.standee ? (
                <StandeeModel urls={urls.standee} {...props} />
              ) : (
                <CharacterModel url={urls.gltf} {...props} />
              )}
            </Suspense>
          )
        })}

        {ownTools.move && (
          <Suspense key={toolKey('move', ownTools.move)} fallback={null}>
            <MovementRuler
              type={ownTools.move.which}
              spawnTarget={spawnModel(toolSpawn.move)}
              {...toolEntry('move')}
              hoverHeight={TOOL_HOVER_HEIGHT}
              selected={selectedTools.move}
              onSelect={() => toggleTool('move')}
              onDragSelect={() => selectTool('move')}
              // A new tool is selected, so its buttons (Place, Bend) can be used right away
              onSpawn={() => selectTool('move')}
              angleLimit={angleLimit}
              target={toolTarget}
              models={toolModels}
              onSnap={selectModel}
              onPlaceLimit={(limit) => {
                placeLimits.current.move = limit
              }}
              limitTaken={limitTool === 'range'}
              onLimitOn={() => setLimitTool('move')}
              {...turnProps('move')}
            />
          </Suspense>
        )}
        {ownTools.angle && (
          <Suspense key={toolKey('angle', ownTools.angle)} fallback={null}>
            <AngleRuler
              {...toolEntry('angle')}
              hoverHeight={TOOL_HOVER_HEIGHT}
              selected={selectedTools.angle}
              onSelect={() => toggleTool('angle')}
              onDragSelect={() => selectTool('angle')}
              onSpawn={() => selectTool('angle')}
              target={toolTarget}
              spawnTarget={toolModel(angleSpawn.target)}
              aim={toolModel(angleSpawn.aim)}
              models={toolModels}
              onSnap={selectModel}
              angleRef={(get) => {
                angleTool.current = get
              }}
              {...turnProps('angle')}
            />
          </Suspense>
        )}
        {ownTools.los && (
          <LosTool
            key={toolKey('los', ownTools.los)}
            {...toolEntry('los')}
            selected={selectedTools.los}
            onSelect={() => toggleTool('los')}
            onDragSelect={() => selectTool('los')}
            onSpawn={() => selectTool('los')}
            onRemove={() => onToolRemove?.('los')}
            models={toolModels}
            {...turnProps('los')}
          />
        )}
        {draggingChar && (
          <Suspense fallback={null}>
            <DeployRangeTool
              getBody={() => charBodies.current.get(draggingCharId)}
              centerZ={
                draggingChar.team === 'host'
                  ? MAT_SIZE / 2 - deployTip
                  : -(MAT_SIZE / 2 - deployTip)
              }
              yaw={draggingChar.team === 'host' ? -Math.PI / 2 : Math.PI / 2}
              team={draggingChar.team}
              hoverHeight={TOOL_HOVER_HEIGHT}
            />
          </Suspense>
        )}
        {otherDragChar && (
          <Suspense fallback={null}>
            <DeployRangeTool
              getBody={() => charBodies.current.get(otherDragId)}
              centerZ={
                otherDragChar.team === 'host'
                  ? MAT_SIZE / 2 - deployTip
                  : -(MAT_SIZE / 2 - deployTip)
              }
              yaw={otherDragChar.team === 'host' ? -Math.PI / 2 : Math.PI / 2}
              team={otherDragChar.team}
              hoverHeight={TOOL_HOVER_HEIGHT}
            />
          </Suspense>
        )}
        {ownTools.range && (
          <Suspense key={toolKey('range', ownTools.range)} fallback={null}>
            <RangeRuler
              number={ownTools.range.which}
              spawnTarget={spawnModel(toolSpawn.range)}
              {...toolEntry('range')}
              hoverHeight={TOOL_HOVER_HEIGHT}
              selected={selectedTools.range}
              onSelect={() => toggleTool('range')}
              onDragSelect={() => selectTool('range')}
              onSpawn={() => selectTool('range')}
              target={toolTarget}
              models={toolModels}
              onSnap={selectModel}
              onPlaceLimit={(limit) => {
                placeLimits.current.range = limit
              }}
              limitTaken={limitTool === 'move'}
              onLimitOn={() => setLimitTool('range')}
              onRangeMark={setRangeMark}
              {...turnProps('range')}
            />
          </Suspense>
        )}
        {Object.entries(otherTools).map(([kind, entry]) =>
          kind === 'los'
            ? entry.pose && (
                <OtherLos
                  key={toolKey(kind, entry)}
                  entry={entry}
                  models={toolModels}
                  selected={otherLook.tools.includes(kind)}
                  getLive={() => received.current?.tool(kind) ?? null}
                />
              )
            : entry.pose && (
                <Suspense key={toolKey(kind, entry)} fallback={null}>
                  <OtherTool
                    kind={kind}
                    entry={entry}
                    team={otherSide}
                    selected={otherLook.tools.includes(kind)}
                    target={otherTarget}
                    rangeFrom={
                      kind === 'range' && entry.which === 1 && entry.snap
                        ? (toolModels.find(
                            (model) => model.kind === entry.snap.kind && model.id === entry.snap.id,
                          ) ?? null)
                        : null
                    }
                    getLive={() => received.current?.tool(kind) ?? null}
                  />
                </Suspense>
              ),
        )}
      </Physics>
    </>
  )
}
