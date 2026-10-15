import { tokenSize } from '../tokens/tokens.js'
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import TokenLayer from './TokenLayer.jsx'
import OwnTools from './OwnTools.jsx'
import OtherTools from './OtherTools.jsx'
import { DeployRangeTool } from './ToolParts.jsx'
import { TOOL_HOVER_HEIGHT } from './toolGeometry.js'
import { createSceneApi } from './sceneApi.js'
import { useModelRegistry } from './useModelRegistry.js'
import { useTerrainHoverLabel } from './useTerrainHoverLabel.js'
import { useTerrainFall } from './useTerrainFall.js'
import { useModelClaims } from './useModelClaims.js'
import { usePieceTurns } from './usePieceTurns.js'
import { useModelSync } from './useModelSync.js'
import CharacterModel, { StandeeModel, modelUrls } from './CharacterModel.jsx'
import CharacterTray from './CharacterTray.jsx'
import TableButtons from './TableButtons.jsx'
import ToolRack from './ToolRack.jsx'
import ToolDragGhost from './ToolDragGhost.jsx'
import SpectatorBadge from './SpectatorBadge.jsx'
import { heldTokensByCharacter } from '../game/heldTokens.js'
import Terrain from './Terrain.jsx'
import CrisisCard from './CrisisCard.jsx'
import ToolPoint from './ToolPoint.jsx'
import WorldRef from './WorldRef.jsx'
import {
  LabelOcclusionLoop,
  LabelOcclusionProvider,
  createLabelRegistry,
} from './LabelOcclusion.jsx'
import LiveSync from './LiveSync.jsx'
import RemoteCursor from './RemoteCursor.jsx'
import Ping from './Ping.jsx'
import SupplyPile from './SupplyPile.jsx'
import TacticTray from './TacticTray.jsx'
import TacticCard from './TacticCard.jsx'
import RosterCards from './RosterCards.jsx'
import GameSetup from './GameSetup.jsx'
import { OnTable, OWNER_FACING_ROTATION } from './OnTable.jsx'
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
import { modelIdOfKey, modelKey } from '../characters/claims.js'
import { assetUrl } from '../assets/index.js'
import { CARD_X, CARD_Y, CARD_Z, supplyPilePosition } from '../crisis/layout.js'
import { getCard } from '../crisis/cards.js'
import { TRAYS } from '../dice/tray.js'
import {
  gruntsByHost,
  inTrayArea,
  layoutTrays,
  trayModelPosition,
  traySpareModelPosition,
  trayConstructPosition,
  trayGruntModelPosition,
  trayShapeOf,
} from '../characters/trays.js'
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
import {
  TEAMS,
  otherTeam,
  rackHiddenSides,
  rosterRowsShown,
  setupStep,
  sideSign,
  sideYaw,
  viewOf,
} from '../setup/setup.js'
import { useSideColors } from '../sideColors.js'

// Two physics steps per frame. With one, a model dropped from high up sometimes gets stuck in terrain.
const TIME_STEP = 1 / 120
// Every piece that loads a file after the first scene load (the mat of a new map, terrain, crisis
// cards and tokens, character trays and models, tactic cards, tools) is in its own Suspense below. While its file
// loads, only that piece is not drawn. Without its own Suspense, the load hides the whole scene (the
// Suspense that React Three Fiber puts around the Canvas content), and the screen flashes black.
// The map and the models of a new table are loaded before the scene mounts (Preload.jsx), so they show
// in the first frame.

// Height of the random map note above the table, as in GameSetup.jsx (TABLE_Y).
const WAIT_NOTE_Y = 0.05

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

// How often (ms) Scene looks for overlapping models
const OVERLAP_INTERVAL = 100

// mapId: key in MAPS. terrain: the terrain pieces on the mat, [{ id, locked, ...placement }] (see
// mapTerrain in rooms/table.js). onTerrainHover(id, over): the pointer moved onto or off an unlocked piece,
// for the Delete key. apiRef: the ref App makes (sceneApi); Scene sets its current to the calls App makes
// into Scene, see sceneApi.js.
// showColliders: draw every physics collider as lines (the shapes physics uses, not the visible meshes)
// turnStep: degrees of one Q / E press and wheel step (settings.turn.step; TTS default 15, PointerRotationSnap).
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
// another reason (the Line of Sight looker left the table), always set.
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
// rosters: { host, guest } → null | { code }, the loaded rosters (RosterCards.jsx). parsedRosters: the same, parsed
// (setup/useGameSetup.js). onRosterOpen({ team, tab,
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
// sceneApi.characterAt is Scene's own characterAt (3D only: the model or the tray's background plate),
// used by App's findCharacterAt below.
// findCharacterAt(clientX, clientY): App's own lookup, the DOM tray controls (data-character-id)
// first, then sceneApi's characterAt. Passed back down so CrisisToken.jsx's Extract-token
// release uses the same lookup as App's token drag, instead of 3D-only characterAt, so a
// release over the tray's controls strip (DOM) counts too.
// sceneApi.modelPosition gives the live table position { x, z } of a character (Rapier body or model
// object, not the spawn position), or null. Used by handleTokenDrop in crisis/useCrisisTokens.js. See "Hold and drop".
// sceneApi.turnPiece is the Q / E turn. heldRotate: ref to a Map of the Q / E actions held down, action id → direction.
// sceneApi.floorPiece is R during a model drag (modelDrag: the id of the dragged own model, else null).
// sceneApi.liftPiece is R. sceneApi.returnModels is the tray's Remove button: the models of that character
// go back to their places on the tray.
// playedSides: the sides this browser plays (dice tray, tool snap selection), one in a multiplayer
// room, both otherwise.
// A token with placeBy can be dragged only by a browser that plays that side (tokens/dropWait.js).
// removeWaits: character id → the text that disables its Remove button while a dropped token waits, or no entry.
// The other tray is only drawn (OtherDiceTray.jsx).
// onDiceTrayHover(side, over): the pointer moved onto or off an own dice tray, for the number keys.
// sceneApi.addDice is for the number keys over that tray. Each own tray puts a function in the addDice
// ref that clears the tray, then adds that many dice (DiceTray.jsx).
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
  apiRef,
  mapId,
  tableButtons,
  toolRack,
  terrain = [],
  onTerrainHover,
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
  turnStep = 15,
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
  findCharacterAt,
  playedSides = TEAMS,
  removeWaits = {},
  onDiceTrayHover,
  diceStore,
  rollsStore,
  transact,
  heldRotate,
  scoreMarkers,
  affiliations,
  rosters = { host: null, guest: null },
  parsedRosters,
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
  // Every model of every character, in spawn order (characters/models.js)
  const models = useMemo(() => characters.flatMap(characterModels), [characters])
  // The maps below are keyed by model id: a character with a second form has two models (see
  // characters/models.js). The first model has the character's own id. See useModelRegistry.js.
  const {
    charBodies,
    worldRef,
    rapierRef,
    charObjects,
    charLifts,
    trayObjects,
    terrainObjects,
    tokenObjects,
    tokenCenters,
    looseObjects,
    looseCenters,
    liveCharBody,
    modelBases,
    characterAt,
    terrainAt,
    terrainUnder,
    modelPosition,
    restPose,
  } = useModelRegistry({ models, characters })
  // Labels that hide behind terrain (LabelOcclusion.jsx)
  const labelRegistry = useMemo(createLabelRegistry, [])
  // The id of the dragged own model, else null (sceneApi.modelDragId)
  const modelDrag = useRef(null)
  // Side -> function of the own dice tray that clears it and adds dice (sceneApi.addDice). DiceTray fills it.
  const addDice = useRef({})
  // { atPointer(), atCenter() }, filled by ToolPoint (sceneApi.pointAtPointer, pointAtCenter)
  const toolPoint = useRef(null)
  // Tool ('move' or 'range') → { owns(model, p), clamp(p, model) } while its Place, Place 1 or Throw is on,
  // else null. A drag of the model that the tool owns is limited by it (see onPlaceLimit in RulerTool.jsx).
  const placeLimits = useRef({})
  // The own tools' live poses for LiveSync: kind → a getter that Tool registers (like toolTurns)
  const toolLives = useRef({})
  // The own dice's live poses for LiveSync: tray side → a getter that DiceTray registers
  const diceLives = useRef({})
  // What LiveSync received: { pose(key), poseTime(key), tool(kind), die(key), cursor() }, or null (LiveSync.jsx)
  const received = useRef(null)
  // The latest live numbers of a piece key, for the pieces that follow
  const getPieceLive = (key) => received.current?.pose(key) ?? null
  const getPieceLiveTime = (key) => received.current?.poseTime(key) ?? null
  const [draggingCharId, setDraggingCharId] = useState(null)
  // The piece that a range tool measures against, { kind, id, mode: 'inRange' | 'outOfRange' } or null.
  // See RangeMark in ToolFootprint.jsx.
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
  const { claimTimes, claims, claimModel } = useModelClaims({ ownership })
  // Ids of the models that show the overlap mark
  const [overlapIds, setOverlapIds] = useState(() => new Set())

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

  const hoverLabelId = useTerrainHoverLabel({ showLabels, terrainUnder })

  const { hoveredPiece, draggedPiece, toolTurns, turnsLeft, trackPiece, turnPiece } = usePieceTurns(
    {
      heldRotate,
      turnStep,
      claimModel,
      liveCharBody,
    },
  )
  const { applyPose } = useModelSync({
    ownership,
    poses,
    otherOwned,
    models,
    liveCharBody,
    charLifts,
    turnsLeft,
    claimTimes,
    restPose,
    onModelRest,
    markMoved,
  })

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
    const id = modelDrag.current
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

  const planFall = useTerrainFall({
    models,
    liveCharBody,
    charLifts,
    ownership,
    worldRef,
    rapierRef,
    terrainObjects,
    terrain,
    claimModel,
    applyPose,
    onModelRest,
  })

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
  // The shape is documented in sceneApi.js.
  useEffect(() => {
    if (apiRef) {
      apiRef.current = createSceneApi({
        characterAt,
        modelPosition,
        returnModels,
        turnPiece,
        liftPiece,
        floorPiece,
        terrainAt,
        planFall,
        modelDrag,
        addDice,
        toolPoint,
      })
    }
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
      const body = liveCharBody(model.id)
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
  const selectedLooseId = selectedId(selection, 'loose')
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
  const toolModels = useMemo(
    () => [
      ...models.map((model) => ({
        kind: 'character',
        id: model.id,
        getBody: () => liveCharBody(model.id),
        getObject: () => charObjects.current.get(model.id),
        getCenter: () =>
          liveCharBody(model.id)?.translation() ?? {
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
      // A token on the table: the tools snap to it and measure its real size (tokenSize)
      ...looseTokens.map((tok) => ({
        kind: 'loose',
        id: tok.id,
        getObject: () => looseObjects.current.get(tok.id),
        getCenter: () => looseCenters.current.get(tok.id)?.() ?? { x: tok.x, y: 0, z: tok.z },
        radius: tokenSize(tok.key) / 2,
      })),
    ],
    [
      models,
      matTokens,
      looseTokens,
      claimModel,
      liveCharBody,
      charObjects.current,
      charLifts.current,
      tokenObjects.current,
      tokenCenters.current,
      looseObjects.current,
      looseCenters.current,
    ],
  )
  // Limits a drag of a character or token with the Place, Place 1 and Throw limits of the tools. Moves p, returns it.
  // The limits take the tool form (getCenter, radius), not the raw model.
  const applyPlaceLimits = (kind, id, p) => {
    const model = toolModels.find((m) => m.kind === kind && m.id === id)
    if (!model) return p
    for (const limit of Object.values(placeLimits.current)) {
      if (limit?.owns(model, p)) limit.clamp(p, model)
    }
    return p
  }
  const setPlaceLimit = (kind, limit) => {
    placeLimits.current[kind] = limit
  }
  const toolModel = (piece) =>
    toolModels.find((model) => piece && model.kind === piece.kind && model.id === piece.id) ?? null
  // The tools measure against the character or token selected last, and a new tool snaps to it.
  // Place moves the selected character, also when a token was selected after it.
  const toolTarget = toolModel(selection.findLast(isToolPiece))
  const otherSide = otherTeam(ownSide)
  const sideColors = useSideColors()
  const ownTools = tools[ownSide] ?? {}
  const otherTools = tools[otherSide] ?? {}
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

      <LabelOcclusionProvider registry={labelRegistry}>
        <Physics gravity={[0, WORLD_GRAVITY, 0]} timeStep={TIME_STEP} debug={showColliders}>
          <WorldRef worldRef={worldRef} rapierRef={rapierRef} />
          <LabelOcclusionLoop registry={labelRegistry} />
          <ToolPoint pointRef={toolPoint} />
          {ownPing && <Ping key={ownPing.id} ping={ownPing} side={ownSide} />}
          {otherLook.ping && (
            <Ping key={otherLook.ping.id} ping={otherLook.ping} side={otherTeam(ownSide)} />
          )}
          {live && ownership && (
            <>
              <LiveSync
                live={live}
                ownership={ownership}
                getBody={(id) => liveCharBody(id)}
                toolLives={toolLives}
                diceLives={diceLives}
                pieceLives={pieceLives}
                liveRef={received}
                hideCursor={Boolean(squadEdit?.[ownSide])}
              />
              <RemoteCursor liveRef={received} ownership={ownership} side={otherTeam(ownSide)} />
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
          {mapId == null && tableButtons.multiplayer && (
            <OnTable position={[0, WAIT_NOTE_Y, 0]} rotation={OWNER_FACING_ROTATION.host}>
              <div className="setup-panel">
                <div className="setup-note">
                  Random map: it spawns automatically when the second player joins the room.
                </div>
              </div>
            </OnTable>
          )}
          <group rotation={[0, (matTurns * Math.PI) / 2, 0]}>
            {/* mapId null: a random room waits for its map. The mat and the terrain load here, in their own
              Suspense, when the map comes. */}
            {mapId != null && (
              <Suspense fallback={null}>
                <Mat mat={MAPS[mapId].mat} rotation={MAPS[mapId].matRotation} />
              </Suspense>
            )}
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
                addRef={(add) => {
                  if (add) addDice.current[trayKey] = add
                  else delete addDice.current[trayKey]
                }}
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
          <TokenLayer
            tokens={tokens}
            characters={characters}
            trayPositions={trayPositions}
            gruntLists={gruntLists}
            trayShape={trayShape}
            selectedTokenId={selectedTokenId}
            selectedLooseId={selectedLooseId}
            rangeMarkOf={rangeMarkOf}
            otherSelectedOf={otherSelectedOf}
            toggleSelect={toggleSelect}
            dragSelect={dragSelect}
            onHeldHover={onHeldHover}
            onPieceHover={onPieceHover}
            playedSides={playedSides}
            applyPlaceLimits={applyPlaceLimits}
            onTokenMove={onTokenMove}
            onTokenTurn={onTokenTurn}
            ownership={ownership}
            pieceLives={pieceLives}
            otherOwned={otherOwned}
            getPieceLive={getPieceLive}
            onTokenHold={onTokenHold}
            findCharacterAt={findCharacterAt}
            affiliations={affiliations}
            tokenObjects={tokenObjects}
            tokenCenters={tokenCenters}
            looseObjects={looseObjects}
            looseCenters={looseCenters}
            looseTokens={looseTokens}
            tokenDrag={tokenDrag}
            onTokenDragStart={onTokenDragStart}
            onLooseHover={onLooseHover}
            tokenPiles={tokenPiles}
            onPileTakeStart={onPileTakeStart}
            onPileMoveStart={onPileMoveStart}
            onPileHover={onPileHover}
            dragPointRef={dragPointRef}
            otherSpawn={otherSpawn}
          />

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
            TEAMS.map(
              (team) =>
                rosters[team] && (
                  <RosterCards
                    key={team}
                    team={team}
                    code={rosters[team].code}
                    squad={
                      setupStep(setup) === 'squads' && !viewOf(setup)
                        ? setup.squads[team]
                        : undefined
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
            parsed={parsedRosters}
            mySide={mySide}
            seatPlayers={seatPlayers}
            actions={setupActions}
            powerOnTable={tableButtons.show.power}
            onStartRound={() => tableButtons.onPowerPhase(playedSides)}
            startRoundBlock={tableButtons.powerBlockTitle(playedSides)}
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
                overlapsAny(
                  { x, y, z, radius: BASE_DIAMETER[model.base] / 2 },
                  modelBases(model.id),
                ),
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
                modelDrag.current = model.id
                trackPiece(draggedPiece, { kind: 'character', id: model.id }, true)
              },
              // cancelled: Esc put the body back, so a Q / E turn that is not done yet is dropped
              onDragEnd: (cancelled) => {
                if (cancelled) turnsLeft.current.delete(modelKey(model.id))
                setDraggingCharId(null)
                ownership?.setDrag(null)
                if (modelDrag.current === model.id) modelDrag.current = null
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
                applyPlaceLimits('character', model.id, p)
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

          <OwnTools
            ownTools={ownTools}
            ownSide={ownSide}
            onToolStore={onToolStore}
            onToolReturn={onToolReturn}
            onToolRemove={onToolRemove}
            toolSpawn={toolSpawn}
            angleSpawn={angleSpawn}
            selectedTools={selectedTools}
            onSelectedToolsChange={onSelectedToolsChange}
            toolTarget={toolTarget}
            toolModels={toolModels}
            toolModel={toolModel}
            onSnap={selectModel}
            onPlaceLimit={setPlaceLimit}
            setRangeMark={setRangeMark}
            turnProps={turnProps}
          />
          {draggingChar && (
            <Suspense fallback={null}>
              <DeployRangeTool
                getBody={() => liveCharBody(draggingCharId)}
                centerZ={sideSign(draggingChar.team) * (MAT_SIZE / 2 - deployTip)}
                yaw={sideYaw(draggingChar.team) - Math.PI / 2}
                team={draggingChar.team}
                hoverHeight={TOOL_HOVER_HEIGHT}
              />
            </Suspense>
          )}
          {otherDragChar && (
            <Suspense fallback={null}>
              <DeployRangeTool
                getBody={() => liveCharBody(otherDragId)}
                centerZ={sideSign(otherDragChar.team) * (MAT_SIZE / 2 - deployTip)}
                yaw={sideYaw(otherDragChar.team) - Math.PI / 2}
                team={otherDragChar.team}
                hoverHeight={TOOL_HOVER_HEIGHT}
              />
            </Suspense>
          )}
          <OtherTools
            otherTools={otherTools}
            otherSide={otherSide}
            otherLook={otherLook}
            toolModels={toolModels}
            received={received}
          />
        </Physics>
      </LabelOcclusionProvider>
    </>
  )
}
