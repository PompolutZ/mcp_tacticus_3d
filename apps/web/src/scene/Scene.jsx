import { tokenSize } from '../tokens/tokens.js'
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, memo } from 'react'
import { useLatest } from './useLatest.js'
import { useThree } from '@react-three/fiber'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import TokenLayer from '../tokens/TokenLayer.jsx'
import OwnTools from '../tabletools/OwnTools.jsx'
import OtherTools from '../tabletools/OtherTools.jsx'
import { DeployRangeTool } from '../tabletools/ToolParts.jsx'
import { TOOL_HOVER_HEIGHT } from '../tabletools/toolGeometry.js'
import { createSceneApi } from './sceneApi.js'
import { captureBoardImage as captureBoard } from '../terrain/boardImage.js'
import { useModelRegistry } from './useModelRegistry.js'
import { useTerrainFall } from '../terrain/useTerrainFall.js'
import { useModelClaims } from './useModelClaims.js'
import { usePieceTurns } from './usePieceTurns.js'
import { useModelSync } from './useModelSync.js'
import SceneModel from './SceneModel.jsx'
import CharacterTray from '../characters/CharacterTray.jsx'
import TableButtons from '../ui/TableButtons.jsx'
import ToolRack from '../tabletools/ToolRack.jsx'
import ToolDragGhost from '../tabletools/ToolDragGhost.jsx'
import { heldTokensByCharacter } from '../game/heldTokens.js'
import Terrain from '../terrain/Terrain.jsx'
import { useTerrainDrag } from '../terrain/useTerrainDrag.js'
import { unlockedView } from '../terrain/builder.js'
import CrisisCard from '../crisis/CrisisCard.jsx'
import ToolPoint from '../tabletools/ToolPoint.jsx'
import WorldRef from './WorldRef.jsx'
import {
  LabelOcclusionLoop,
  LabelOcclusionProvider,
  createLabelRegistry,
} from './LabelOcclusion.jsx'
import LiveSync from './LiveSync.jsx'
import RemoteCursor from './RemoteCursor.jsx'
import Ping from './Ping.jsx'
import SupplyPile from '../tokens/SupplyPile.jsx'
import TacticTray from '../tactics/TacticTray.jsx'
import TacticCard from '../tactics/TacticCard.jsx'
import RosterCards from '../rosters/RosterCards.jsx'
import GameSetup from '../setup/GameSetup.jsx'
import { OnTable, OWNER_FACING_ROTATION } from './OnTable.jsx'
import DiceTray from '../dice/DiceTray.jsx'
import OtherDiceTray from '../dice/OtherDiceTray.jsx'
import { useDiceTrayPointer } from '../dice/useDiceTrayPointer.js'
import ScoreBoard from '../scoreboard/ScoreBoard.jsx'
import PriorityMarker from '../game/PriorityMarker.jsx'
import { Backdrop, Mat, SceneLights, TableSurface } from './SceneShared.jsx'
import { BASE_DIAMETER } from '../characters/files.js'
import { characterGiveSources, characterName, characterSize } from '../characters/characters.js'
import {
  characterModels,
  characterOnBoard,
  modelFigureYaw,
  modelSpawnYaw,
  trayCards,
  yawQuaternion,
} from '../characters/models.js'
import { FRICTION, WORLD_GRAVITY } from '../physics.js'
import { overlapMarks } from '../characters/overlap.js'
import { modelIdOfKey, modelKey } from '../characters/claims.js'
import { CARD_X, CARD_Y, CARD_Z, supplyPilePosition } from '../crisis/layout.js'
import { getCard } from '../crisis/cards.js'
import { TRAYS } from '../dice/tray.js'
import {
  inTrayArea,
  trayModelPosition,
  traySpareModelPosition,
  trayConstructPosition,
  trayGruntModelPosition,
  trayShapeOf,
} from '../characters/trays.js'
import { MAT_SIZE, TABLE_WALLS } from '../table.js'
import { rangeLength } from '../tabletools/toolTips.js'
import { selectPiece, toolSelects } from '../selection.js'
import { poseOf, tableMat } from '../rooms/table.js'
import {
  TEAMS,
  otherTeam,
  rackHiddenSides,
  rosterRowsShown,
  setupStep,
  phaseHudShown,
  sideSign,
  sideYaw,
  viewOf,
} from '../setup/setup.js'
import { useOtherDragKey, useOtherOwned, useOtherPresence } from '../table/useOtherPlayer.jsx'
import { useTrayLayout } from '../characters/useTrayLayout.js'
import { useYField, useYList } from '../net/useY.js'
import { useTableStore } from '../table/TableStoreContext.jsx'
import { useRenderCount, useRenderReason } from '../debug/renderCount.js'

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

const NO_TOOLS_RECORD = {}
const NO_POSES = {}
const NO_LIST = []
const NO_SIDE_TOOLS = {}

// How often (ms) Scene looks for overlapping models
const OVERLAP_INTERVAL = 100

// The handlers (onPieceHover, onTokenMove, onCardOpen, onToolStore and the others named below) are not props. Scene and its
// leaves call them from the actions of the store (table/tableStore.js, ACTION_NAMES), which App registers after each render.
// build: null, or { onDrop(id, dx, dz) } in Build mode (terrain/useTerrainDrag.js). mapId: key in MAPS. terrain: the terrain pieces on the mat, [{ id, locked, ...placement }] (see
// mapTerrain in rooms/table.js). onTerrainHover(id, over): the pointer moved onto or off an unlocked piece,
// for the Delete key. apiRef: the ref App makes (sceneApi); Scene sets its current to the calls App makes
// into Scene, see sceneApi.js.
// The seat and the settings are in the store of the table, App writes them (table/tableStore.js): showColliders (draw
// every physics collider as lines), turnStep (settings.turn.step, degrees of one Q / E press and wheel step; TTS
// default 15), spectator (the spectator view above each model, SpectatorBadge.jsx), playedSides, ownSide. Terrain
// reads showLabels, DiceTray rethrowTilted, GameSetup mySide and nameCtx.
// crisis: { secure, extract } chosen card keys. tokens: every crisis token on the table (see App.jsx).
// The selection (selection.js), the selected tools, the tool spawn state and the token and tool drag are in the store
// (table/tableStore.js). Each piece reads its own flag there, so Scene does not render on a selection change.
// onPieceHover(piece, over): the pointer moved onto (true) or off (false) a character or a token,
// piece as { kind, id }. tools: the `tools` record of the document, side → kind → entry (storedTool.js).
// ownSide (store): 'host' or 'guest', the side of this browser. The own entries become tools; the key of a tool is
// its `which` and `spawn`, so a new spawn mounts it again. The entry of the other side that has a pose
// becomes an OtherTool. onToolStore(kind, spawn, fields): a tool of the own side rests, App writes the
// fields into its entry. toolReturn: a move drag of an own tool that ends on the own rack removes the tool (action onToolReturn(kind),
// RulerTool.jsx, onReturn). false: the tools do not return. The same action removes a tool for
// another reason (the Line of Sight looker left the table), always set.
// The tray's controls (Damage, Power, flip, Remove, a click on a token of the "On" row) and the Priority click call
// the table actions from the store (table/tableStore.js).
// onTrayCardHover(id, over): the pointer moved onto (true) or off (false) a character's tray card,
// for the F key.
// onTokenDragStart(e, key, looseId, giveId): pointerdown on a tray's Give source (giveId: the character of the
// tray), or on a token on the table (looseId). See drag/useTokenDrag.js, handleTokenDragStart.
// onCardHover(card, over): the pointer moved onto or off a card or a model, card as { src, alt, by }, for Alt
// (App.jsx).
// looseTokens: the character tokens that lie on the table, [{ id, key, x, z }] (see App.jsx).
// onLooseHover(id, over): the pointer moved onto or off one of them, for the Delete key.
// onPileTakeStart(e, pile), onPileMoveStart(e, pile): a drag on a pile takes a token, or with Shift
// moves the pile. onPileHover(id, over): for the Delete key.
// onTacticMove(id,
// x, z): a card drag ended over the table. onTacticHover(id, over): for the F and Delete keys. A
// click on a card opens it with onCardOpen, the same as a crisis card.
// rosters: { host, guest } → null | { code }, the loaded rosters (RosterCards.jsx). parsedRosters: the same, parsed
// (setup/useGameSetup.js). onRosterOpen({ team, tab,
// index }): a click on a roster card. It opens the roster popup on that card (see RosterPopup.jsx).
// onCrisisOpen({ team, type, code, drawn }): a click on a crisis card of the setup (GameSetup.jsx).
// squadEdit: { host, guest } → true: the roster cards of that side have the + / ✓ button, and onSquadToggle(team,
// tab, index) adds the card to the squad or removes it (setup/useGameSetup.js, handleSquadToggle).
// setup: the game setup (setup/setup.js). When the squads
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
// A token with placeBy can be dragged only by a browser that plays that side (tokens/dropWait.js).
// removeWaits: character id → the text that disables its Remove button while a dropped token waits, or no entry.
// The other tray is only drawn (OtherDiceTray.jsx).
// onDiceTrayHover(side): the own dice tray under the pointer changed (side or null), for the number keys.
// sceneApi.addDice is for the number keys over that tray. Each own tray puts a function in the addDice
// ref that clears the tray, then adds that many dice (DiceTray.jsx).
// onTokenHold(tokenId, characterId, cardPoint): a canHold token was released over a character.
// cardPoint: the tray-local [x, z] on that character's card (trays.js, trayHeldLocal) when the
// release point is on its tray, otherwise null.
// onHeldHover(tokenId, over): the pointer moved onto or off a crisis token that a character holds,
// for the Delete key, the same as onLooseHover.
// onSupplyDragStart(e, cardKey): pointerdown on the supply pile of a Source card (SupplyPile.jsx).
// scoreMarkers, affiliations, onScoreMarkerMove(marker, x, z): the scoring board markers, see
// ScoreBoard.jsx.
// priority, priorityTitle: the Priority marker (PriorityMarker.jsx). priority: the side, or null.
// From the table store (table/tableStore.js), not props: table, ownership, presence, live. Scene reads
// matTurns (the mat turns, 90° counter-clockwise each) and the Team Tactic cards from the table document, and the
// stored pose of a model (table.poses.get, read when the model mounts). A model that fell asleep stores its pose
// there, so it starts there when the table opens again (docs/features/peer-to-peer.md, "Yjs document").
// presence: Scene writes the own range mark and reads the other player's selection and mark. ownership: Scene
// claims a model before R, Q / E, Throw, Place and a drag, releases it when the body rests, and writes the rest
// pose (docs/features/peer-to-peer.md, "Rules"). live: with it, Scene mounts LiveSync and the cursor.
// ownPing: the last ping of this browser (App, key P). The other player's ping comes with presence (ping.md).
// poses: the live rest poses of the models, model id → pose (the table document). A pose that the other browser
// wrote moves the body ("Rules").
function Scene(props) {
  const {
    apiRef,
    mapId,
    tableButtons,
    toolRack,
    terrain = NO_LIST,
    build = null,
    characters = NO_LIST,
    tools = NO_TOOLS_RECORD,
    toolReturn = false,
    deployLine = false,
    crisis = { secure: null, extract: null },
    tokens = NO_LIST,
    looseTokens = NO_LIST,
    diceMenu = null,
    removeWaits = {},
    heldRotate,
    scoreMarkers,
    affiliations,
    rosters = { host: null, guest: null },
    parsedRosters,
    setup,
    squadEdit,
    priority,
    priorityTitle,
    poses = NO_POSES,
    ownPing = null,
  } = props
  useRenderCount('Scene')
  // The seat and the settings (table/tableStore.js), written by App
  const ownSide = useTableStore((s) => s.ownSide)
  const playedSides = useTableStore((s) => s.playedSides)
  const spectator = useTableStore((s) => s.spectator)
  const showColliders = useTableStore((s) => s.showColliders)
  const brightness = useTableStore((s) => s.settings.light.brightness) / 100
  const ambient = useTableStore((s) => s.look.ambient)
  const corner = useTableStore((s) => s.look.corner)
  const turnStep = useTableStore((s) => s.settings.turn.step)
  // The net objects and the doc slices that only Scene and its leaves read (table/tableStore.js)
  const table = useTableStore((s) => s.table)
  const ownership = useTableStore((s) => s.ownership)
  const live = useTableStore((s) => s.live)
  // The stable actions (table/tableStore.js, createActions)
  const actions = useTableStore((s) => s.actions)
  // The own dice tray under the pointer, for the number keys (dice/useDiceTrayPointer.js)
  useDiceTrayPointer(playedSides, actions.onDiceTrayHover)
  const [matTurns] = useYField(table.game, 'matTurns')
  const [gameMat] = useYField(table.game, 'mat')
  const mat = tableMat(mapId, gameMat)
  const [tacticCards] = useYList(table.tactics)
  const startPose = table.poses.get
  const onModelRest = table.poses.setField
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
  const labelRegistry = useMemo(() => createLabelRegistry(), [])
  // The id of the dragged own model, else null (sceneApi.modelDragId)
  const modelDrag = useRef(null)
  // Side -> function of the own dice tray that clears it and adds dice (sceneApi.addDice). DiceTray fills it.
  const addDice = useRef({})
  const registerAddDice = useCallback((trayKey, add) => {
    if (add) addDice.current[trayKey] = add
    else delete addDice.current[trayKey]
  }, [])
  // { atPointer(), atCenter() }, filled by ToolPoint (sceneApi.pointAtPointer, pointAtCenter)
  const toolPoint = useRef(null)
  // Tool ('move' or 'range') → { owns(model, p), clamp(p, model) } while its Place, Place 1 or Throw is on,
  // else null. A drag of the model that the tool owns is limited by it (see onPlaceLimit in RulerTool.jsx).
  const placeLimits = useRef({})
  // The own tools' live poses for LiveSync: kind → a getter that Tool registers (like toolTurns)
  const toolLives = useRef({})
  // The own dice's live poses for LiveSync: tray side → a getter that DiceTray registers
  const diceLives = useRef({})
  // What LiveSync received (LiveSync.jsx). It and the live getters of the pieces that follow are in the store.
  const received = useTableStore((s) => s.received)
  // Model id → number that grows with each move of the model (overlap.js). A model that never moved has none.
  const moved = useRef(new Map())
  const moveCount = useRef(0)
  const markMoved = useCallback((id) => moved.current.set(id, ++moveCount.current), [])
  const { claimTimes, claims, claimModel } = useModelClaims({ ownership })

  // Every 100 ms: which models overlap. The store changes only when the set changes (setOverlapIds).
  const basesNow = useLatest(modelBases)
  useEffect(() => {
    const id = setInterval(() => {
      const list = basesNow.current().map((m) => ({
        ...m,
        moved: moved.current.get(m.id) ?? 0,
      }))
      const marks = overlapMarks(list)
      actions.setOverlapIds(marks)
    }, OVERLAP_INTERVAL)
    return () => clearInterval(id)
  }, [basesNow, actions])

  const { hoveredPiece, draggedPiece, toolTurns, turnsLeft, trackPiece, turnPiece } = usePieceTurns(
    {
      heldRotate,
      turnStep,
      claimModel,
      liveCharBody,
    },
  )
  const { applyPose, onOtherClaims } = useModelSync({
    ownership,
    poses,
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
  // (applyPose cancels it) and does not animate down, which would move the body back to the place before the lift.
  // The pose goes to the document at once, the same as a rest. The other browser waits for the claim of
  // this one to end, then applies it (the otherOwned effect); with no claim it applies it at once.
  function returnModels(characterId) {
    for (const model of models) {
      if (model.character.id !== characterId || !charBodies.current.has(model.id)) continue
      if (!claimModel(model.id)) continue
      turnsLeft.current.delete(modelKey(model.id))
      const [x, y, z] = trayPlace(model)
      const pose = poseOf({ x, y, z }, yawQuaternion(modelSpawnYaw(model.character.team)))
      applyPose(model.id, pose)
      onModelRest?.(model.id, pose)
    }
  }

  const { planFall, raiseModels } = useTerrainFall({
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
  // The same function on every render (the refs and trackPiece never change), so OwnTools can be memo.
  const turnProps = useCallback(
    (tool) => {
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
    },
    [trackPiece, hoveredPiece, draggedPiece, toolTurns, toolLives],
  )

  // The top view of the mat and the terrain (terrain/boardImage.js). matGroup: the group that turns with matTurns.
  const gl = useThree((state) => state.gl)
  const threeScene = useThree((state) => state.scene)
  const toneMapping = useTableStore((s) => s.look.toneMapping)
  const matGroup = useRef(null)
  const captureBoardImage = () =>
    captureBoard({ gl, scene: threeScene, keep: matGroup.current, turns: matTurns, toneMapping })

  // Registered after every render of Scene, so the closures above see the latest characters and objects. Every
  // value they read is a prop or a store value that Scene reads, so they change only when Scene renders (it is
  // memo). A layout effect: App can call the api in the commit that follows. The shape is documented in sceneApi.js.
  useLayoutEffect(() => {
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
        raiseModels,
        captureBoardImage,
        modelDrag,
        addDice,
        toolPoint,
      })
    }
  })

  // Tray position of every character (trays.js). A player's row recenters when that player adds
  // or removes a character, so these positions change then.
  const { trayPositions, gruntLists, trayShape } = useTrayLayout(characters)
  // Tray positions of the last layout, to find the trays that moved.
  const lastTrayPositions = useRef(new Map())
  // A model that still stands on its tray moves with the tray, the same as TTS (moveTray in the
  // tray script). A model that the player moved off its tray, for example onto the mat, stays. A
  // spare model past the Give sources (Hulkbuster's Iron Man) counts as on the tray (inTrayArea).
  const trayNow = useLatest({ models, ownership, characters, gruntLists, liveCharBody })
  useEffect(() => {
    const { models, ownership, characters, gruntLists, liveCharBody } = trayNow.current
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
  }, [trayPositions, trayNow])

  // Deploy-line: R3 zone depth from the deployment edge
  // The R3 tool lies with its far end on the deployment edge, so it spans the whole R3 length from it.
  const deployDepth = rangeLength(3)
  const deployTip = deployDepth / 2

  // Every character and every mat token as the range and movement tools see them. A character has a
  // Rapier body; a token does not, so getCenter (not getBody) is what the tools measure with.
  // getBody is only used where a tool moves a piece (Place, Throw), and both are disabled for a token.
  // isLifted is for a Throw: a lifted character does not stop it.
  // A held token is not in this list: it is off the mat, on its holder's tray (see "Hold and drop").
  const matTokens = useMemo(() => tokens.filter((tok) => !tok.heldBy), [tokens])
  // For the spectator view: the held tokens of each character, in the order it took them
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
        // For Advance: moves the character along the path (slidePath in throwPath.js)
        slide: (path, duration) => charLifts.current.get(model.id)?.slide(path, duration),
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
      markMoved,
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
  const applyPlaceLimits = useCallback(
    (kind, id, p) => {
      const model = toolModels.find((m) => m.kind === kind && m.id === id)
      if (!model) return p
      for (const limit of Object.values(placeLimits.current)) {
        if (limit?.owns(model, p)) limit.clamp(p, model)
      }
      return p
    },
    [toolModels],
  )
  const setPlaceLimit = useCallback((kind, limit) => {
    placeLimits.current[kind] = limit
  }, [])
  const toolModel = useCallback(
    (piece) =>
      toolModels.find((model) => piece && model.kind === piece.kind && model.id === piece.id) ??
      null,
    [toolModels],
  )
  const otherSide = otherTeam(ownSide)
  const onTerrainSelect = useCallback((id) => actions.toggleSelect('terrain', id), [actions])
  const onTerrainObject = useCallback(
    (id, obj) => (obj ? terrainObjects.current.set(id, obj) : terrainObjects.current.delete(id)),
    [terrainObjects.current],
  )
  // Build mode (docs/features/map-builder.md): every terrain piece acts unlocked, in this view only (the document
  // keeps the locks), and a press on a piece drags it. build: { onDrop(id, dx, dz) } or null.
  const terrainDrag = useTerrainDrag({
    onDrop: (id, dx, dz) => build?.onDrop(id, dx, dz),
    onSelect: (id) => actions.dragSelect('terrain', id),
  })
  const shownTerrain = useMemo(() => (build ? unlockedView(terrain) : terrain), [build, terrain])
  // Why Scene commits (DebugPanel, "Scene reasons")
  useRenderReason('Scene', {
    ...Object.fromEntries(Object.entries(props).map(([k, v]) => [`prop:${k}`, v])),
    'doc:matTurns': matTurns,
    'doc:tacticCards': tacticCards,
    'table:ownSide': ownSide,
    'table:playedSides': playedSides,
    'table:spectator': spectator,
    'table:showColliders': showColliders,
    'table:turnStep': turnStep,
    'hook:useModelClaims.claims': claims,
    'hook:useModelClaims.claimModel': claimModel,
  })
  const ownTools = tools[ownSide] ?? NO_SIDE_TOOLS
  const otherTools = tools[otherSide] ?? NO_SIDE_TOOLS
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
    const giveCount = characterGiveSources(ch.key, affiliations?.[ch.team]).length
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

  // A tool snapped to model. It does not select a model of a side this browser does not play.
  const selectModel = useCallback(
    (model) => {
      const piece = { kind: model.kind, id: model.id }
      if (!toolSelects(piece, characters, playedSides)) return
      actions.setSelection((prev) => selectPiece(prev, piece))
    },
    [characters, playedSides, actions],
  )

  // Where a model starts: it reads this only on mount (SceneModel), so a new value renders nothing
  function spawnOf(model) {
    const pose = startPose?.(model.id)
    return {
      position: modelSpawnPosition(model),
      quaternion: pose
        ? [pose.qx, pose.qy, pose.qz, pose.qw]
        : startQuaternion(model.character.team),
      rotation: [0, modelFigureYaw(model), 0],
    }
  }
  // What SceneModel needs: the refs and trackers never change. The helpers (now) are read by handlers only.
  const modelNow = useLatest({
    deployLine,
    deployDepth,
    applyPlaceLimits,
    modelBases,
    restPose,
    onModelRest,
  })
  // The id of the dragged own model (sceneApi.modelDragId): set at a drag start, cleared at its end
  const startModelDrag = useCallback((id) => {
    modelDrag.current = id
  }, [])
  const endModelDrag = useCallback((id) => {
    if (modelDrag.current === id) modelDrag.current = null
  }, [])
  const modelCtx = useMemo(
    () => ({
      refs: {
        charBodies,
        charObjects,
        charLifts,
        startModelDrag,
        endModelDrag,
        turnsLeft,
        hoveredPiece,
        draggedPiece,
        markMoved,
        trackPiece,
      },
      now: modelNow,
    }),
    [
      charBodies,
      charObjects,
      charLifts,
      startModelDrag,
      endModelDrag,
      turnsLeft,
      hoveredPiece,
      draggedPiece,
      markMoved,
      trackPiece,
      modelNow,
    ],
  )
  const rackHidden = useMemo(() => rackHiddenSides(setup, rosters), [setup, rosters])
  const startRoundBlock =
    playedSides.map((side) => tableButtons.powerBlock[side]).find(Boolean) ?? null

  return (
    <>
      {/* Background image. The dark color shows while the image loads. */}
      <Suspense fallback={<color attach="background" args={['#050510']} />}>
        <Backdrop />
      </Suspense>

      <SceneLights ambient={ambient} corner={corner} brightness={brightness} />

      <LabelOcclusionProvider registry={labelRegistry}>
        <Physics gravity={[0, WORLD_GRAVITY, 0]} timeStep={TIME_STEP} debug={showColliders}>
          <WorldRef worldRef={worldRef} rapierRef={rapierRef} />
          <LabelOcclusionLoop registry={labelRegistry} />
          <ToolPoint pointRef={toolPoint} />
          {ownPing && <Ping key={ownPing.id} ping={ownPing} side={ownSide} />}
          <OtherPing />
          {live && ownership && (
            <>
              <LiveSync
                getBody={(id) => liveCharBody(id)}
                toolLives={toolLives}
                diceLives={diceLives}
                liveRef={received}
                hideCursor={Boolean(squadEdit?.[ownSide])}
              />
              <RemoteCursor liveRef={received} side={otherTeam(ownSide)} />
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
          <group ref={matGroup} rotation={[0, (matTurns * Math.PI) / 2, 0]}>
            {/* mapId null: a random room waits for its map. The mat and the terrain load here, in their own
              Suspense, when the map comes. */}
            {mat && (
              <Suspense fallback={null}>
                <Mat mat={mat.name} rotation={mat.rotation} />
              </Suspense>
            )}
            {/* A fixed body does not follow its parent after it is created. So each turn mounts the terrain again,
              and its colliders are created at the new pose. A new map also mounts it again. */}
            <Suspense key={`${mapId}-${matTurns}`} fallback={null}>
              <Terrain
                placements={shownTerrain}
                terrainUnder={terrainUnder}
                groupRef={build ? terrainDrag.groupRef : undefined}
                onPointerDown={build ? terrainDrag.onPointerDown : undefined}
                onSelect={onTerrainSelect}
                onHover={actions.onTerrainHover}
                objectRef={onTerrainObject}
              />
            </Suspense>
          </group>

          {/* Dice trays are relative to the table, not the mat: not keyed by mapId or matTurns, so a
            map change or a mat turn (which remounts Terrain above) never remounts them and their
            dice keep their state. See docs/features/dice-rolling.md. */}
          {Object.keys(TRAYS).map((trayKey) =>
            playedSides.includes(trayKey) ? (
              <OwnDiceTray
                key={trayKey}
                trayKey={trayKey}
                diceLives={diceLives}
                registerAddDice={registerAddDice}
                testHook={trayKey === ownSide}
                openDieId={diceMenu?.trayKey === trayKey ? diceMenu.dieId : null}
              />
            ) : (
              <OtherDiceTray key={trayKey} trayKey={trayKey} liveRef={received} />
            ),
          )}

          {/* The scoring board is relative to the table, the same as the dice trays */}
          <ScoreBoard
            markers={scoreMarkers}
            affiliations={affiliations}
            onMarkerMove={actions.onScoreMarkerMove}
          />
          <PriorityMarker
            priority={priority}
            title={priorityTitle}
            onClick={actions.phases.priorityClick}
          />

          {/* Crisis cards and tokens are relative to the player sides, not the mat, so they stay
            outside the rotating group above: a mat turn must not turn them. See docs/features/crisis.md. */}
          {crisis.secure && (
            <Suspense fallback={null}>
              <CrisisCard
                cardKey={crisis.secure}
                position={[CARD_X, CARD_Y, CARD_Z.secure]}
                onOpen={actions.onCardOpen}
                onCardHover={actions.onCardHover}
              />
            </Suspense>
          )}
          {crisis.extract && (
            <Suspense fallback={null}>
              <CrisisCard
                cardKey={crisis.extract}
                position={[CARD_X, CARD_Y, CARD_Z.extract]}
                onOpen={actions.onCardOpen}
                onCardHover={actions.onCardHover}
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
                  onDragStart={(e) => actions.onSupplyDragStart(e, key)}
                />
              )
            )
          })}
          <TokenLayer
            tokens={tokens}
            characters={characters}
            applyPlaceLimits={applyPlaceLimits}
            affiliations={affiliations}
            tokenObjects={tokenObjects}
            tokenCenters={tokenCenters}
            looseObjects={looseObjects}
            looseCenters={looseCenters}
            looseTokens={looseTokens}
          />

          {/* The tactic tray of each player, between the mat and the character trays, and the Team
            Tactic cards. Relative to the table, not the mat. See docs/features/team-tactic-cards.md. */}
          {/* Power Phase and the board strip of each player (docs/features/table-tools.md) */}
          <TableButtons {...tableButtons} />
          {/* The tool rack of each player (docs/features/table-tools.md, "Tool rack") */}
          {toolRack && <ToolRack tools={tools} hiddenSides={rackHidden} {...toolRack} />}
          <ToolDragGhost />
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
                    editable={Boolean(squadEdit?.[team])}
                  />
                ),
            )}
          <GameSetup
            setup={setup}
            parsed={parsedRosters}
            powerOnTable={tableButtons.show.power}
            powerHudShown={phaseHudShown(setup, tableButtons.multiplayer)}
            startRoundBlock={startRoundBlock}
          />
          {tacticCards.map((card, i) => (
            <Suspense key={card.id} fallback={null}>
              <TacticCard
                card={card}
                stackIndex={i}
                onMove={(x, z) => actions.onTacticMove(card.id, x, z)}
                onOpen={actions.onCardOpen}
                onHover={(over) => actions.onTacticHover(card.id, over)}
                onCardHover={actions.onCardHover}
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
                  affiliation={affiliations?.[ch.team] ?? null}
                  slot={trayShape(ch).slot}
                  onBoard={characterOnBoard(ch, poses)}
                  removeWait={removeWaits[ch.id] ?? null}
                  objects={trayObjects}
                />
              </Suspense>
            ))}

          {models.map((model) => (
            <SceneModel
              key={model.id}
              model={model}
              spawn={spawnOf(model)}
              claims={claims}
              spectator={spectator}
              held={spectator ? heldTokens.get(model.character.id) : undefined}
              ctx={modelCtx}
            />
          ))}

          <OwnTools
            ownTools={ownTools}
            canReturn={toolReturn}
            toolModels={toolModels}
            toolModel={toolModel}
            onSnap={selectModel}
            onPlaceLimit={setPlaceLimit}
            turnProps={turnProps}
          />
          {deployLine && (
            <DeployRanges deployTip={deployTip} models={models} liveCharBody={liveCharBody} />
          )}
          <ClaimSync onChange={onOtherClaims} />
          <OtherTools otherTools={otherTools} toolModels={toolModels} />
        </Physics>
      </LabelOcclusionProvider>
    </>
  )
}

// The deploy lock zones (R3 deep from the deployment edge) of the dragged own model and of the model that the other
// player drags. Own component: a drag renders it, not Scene.
// The dice tray of a side this browser plays. The handlers are made here, so DiceTray (memo) gets the same
// props while the menu of its die is not changed. addDice: the ref of Scene (sceneApi.addDice).
function OwnDiceTray({ trayKey, diceLives, registerAddDice, testHook, openDieId }) {
  const actions = useTableStore((s) => s.actions)
  const onDieOpen = useCallback(
    (dieId) => actions.onDiceMenuOpen(trayKey, dieId),
    [actions, trayKey],
  )
  const addRef = useCallback((add) => registerAddDice(trayKey, add), [registerAddDice, trayKey])
  return (
    <DiceTray
      trayKey={trayKey}
      diceLives={diceLives}
      testHook={testHook}
      openDieId={openDieId}
      onDieOpen={onDieOpen}
      onMenuClose={actions.onDiceMenuClose}
      addRef={addRef}
    />
  )
}

function DeployRanges({ deployTip, models, liveCharBody }) {
  const ownership = useTableStore((s) => s.ownership)
  const draggingCharId = useTableStore((s) => s.draggingCharId)
  const otherDragKey = useOtherDragKey()
  const draggingChar = draggingCharId
    ? models.find((model) => model.id === draggingCharId)?.character
    : null
  // The other player's drag: the model, if they own its key
  const otherDragId = otherDragKey ? modelIdOfKey(otherDragKey) : null
  const otherDragModel =
    otherDragId !== null && ownership?.owner(otherDragKey) === 'other'
      ? models.find((model) => model.id === otherDragId)
      : null
  const otherDragChar = otherDragModel?.character ?? null
  return (
    <>
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
    </>
  )
}

// The ping of the other player (ping.md). Own component: a ping renders it, not Scene.
function OtherPing() {
  const ping = useOtherPresence((p) => p.ping)
  const side = useTableStore((s) => otherTeam(s.ownSide))
  return ping && <Ping key={ping.id} ping={ping} side={side} />
}

// Calls onChange(prev, next) after the claims of the other player change. It renders on each change, so Scene does not.
// It is placed after the models, so their effects (the remote mode) run first, as when Scene read the claims.
function ClaimSync({ onChange }) {
  const otherOwned = useOtherOwned()
  const prev = useRef(otherOwned)
  const latest = useLatest(onChange)
  useEffect(() => {
    latest.current(prev.current, otherOwned)
    prev.current = otherOwned
  }, [otherOwned, latest])
  return null
}

export default memo(Scene)
