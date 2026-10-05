import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Raycaster, Vector3 } from 'three'
import { useTexture, Stars, Environment } from '@react-three/drei'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { MovementRuler, RangeRuler, DeployRangeTool, RANGE_TIP } from './RulerTool.jsx'
import CharacterModel, { turnBody } from './CharacterModel.jsx'
import Character from './Character.jsx'
import CharacterTray from './CharacterTray.jsx'
import Terrain from './Terrain.jsx'
import CrisisCard from './CrisisCard.jsx'
import CrisisToken from './CrisisToken.jsx'
import LooseToken from './LooseToken.jsx'
import TokenDragPreview from './TokenDragPreview.jsx'
import TokenFace from './TokenFace.jsx'
import SupplyPile, { SupplyToken } from './SupplyPile.jsx'
import DiceTray from './DiceTray.jsx'
import ScoreBoard from './ScoreBoard.jsx'
import { projectFootprints } from './footprintProjection.js'
import { matImage } from '../terrain/files.js'
import { characterModel, characterStandee, BASE_DIAMETER } from '../characters/files.js'
import { MAPS } from '../terrain/maps.js'
import { FRICTION, WORLD_GRAVITY } from '../physics.js'
import { assetUrl } from '../assets/index.js'
import { CARD_X, CARD_Y, CARD_Z, supplyPilePosition } from '../crisis/layout.js'
import { getCard } from '../crisis/cards.js'
import { TRAYS } from '../dice/tray.js'
import { TRAY_Y, layoutTrays, onTray, trayHeldLocal, trayHeldWorld, trayModelPosition, trayYaw } from '../characters/trays.js'
import { TOKEN_THICKNESS } from '../tokens/solid.js'
import { TABLE_COLLIDER_HALF_H, TABLE_DEPTH, TABLE_WALLS, TABLE_WIDTH } from '../table.js'

// MCP mat is 36" x 36". 1 Three.js unit = 1 inch. Table size: see table.js.
const MAT_SIZE = 36
const TABLE_THICKNESS = 0.5
// The table image of the TTS mod (its TableURL). The image is 3:2, the same as the TTS table. The app table is
// deeper (table.js), so the image fills the table depth and its left and right ends are cut off. The planks
// keep their shape.
function fitTableTexture(texture) {
  const repeatX = (TABLE_WIDTH / TABLE_DEPTH) / (texture.image.width / texture.image.height)
  texture.repeat.set(repeatX, 1)
  texture.offset.set((1 - repeatX) / 2, 0)
}
// Tools hang this far above the table and measure by the outline cast below them
const TOOL_HOVER_HEIGHT = 1
// Only one player uses the app for now, so the toolbar tools are blue. Per-side tools come later
// (docs/feature-peer-to-peer.md).
const TOOL_TEAM = 'blue'
// Two physics steps per frame. With one, a model dropped from high up sometimes gets stuck in terrain.
const TIME_STEP = 1 / 120
// Tokens held by one character lie on its card in a stack, in the order they were taken, so two
// tokens that overlap do not z-fight. Each one is this much higher than the one before it.
const HELD_STACK_STEP = TOKEN_THICKNESS + 0.01
// The dragged token gets no pointer events, so it does not hide what is under it
const NO_RAYCAST = () => null
// One Q / E press turns a piece this much. The TTS default (PointerRotationSnap in the TTS settings, read on 2026-10-05).
const ROTATE_STEP = 15 * Math.PI / 180
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
// cards and tokens, character trays and models, tools) is in its own Suspense below. While its file
// loads, only that piece is not drawn. Without its own Suspense, the load hides the whole scene (the
// Suspense that React Three Fiber puts around the Canvas content), and the screen flashes black.

// The mat image. Its own component, so a new map's image loads inside the mat's Suspense below.
function Mat({ mat }) {
  const map = useTexture(assetUrl(matImage(mat)))
  return (
    <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[MAT_SIZE, MAT_SIZE]} />
      <meshStandardMaterial map={map} roughness={1} metalness={0} onBeforeCompile={projectFootprints} />
    </mesh>
  )
}

// mapId: key in MAPS
// showColliders: draw every physics collider as lines (the shapes physics uses, not the visible meshes)
// showLabels: show the piece name and game Size above each terrain piece
// matTurns: number of 90° counter-clockwise turns of the mat and its terrain
// crisis: { secure, extract } chosen card keys. tokens: every crisis token on the table (see App.jsx).
// selection: { kind: 'character' | 'token', id } | null, lifted to App so a character and a token
// share one selection. onSelectionChange: the setter, called with a value or an updater function.
// onPieceHover(piece, over): the pointer moved onto (true) or off (false) a character or a token,
// piece as { kind, id }. toolSpawns: { range, move }, a count that changes when App spawns that tool
// again. It is part of the tool key, so the tool mounts again and snaps to the selection.
// selectedTool: 'range' | 'move' | null, lifted to App with its setter onSelectedToolChange.
// One tool can be selected at the same time as a character or a token.
// onCharacterDamage(id, damage), onCharacterPower(id, power), onCharacterFlip(id): the tray's
// controls, lifted to App the same way as the token handlers above (see TrayControls.jsx).
// onTrayCardHover(id, over): the pointer moved onto (true) or off (false) a character's tray card,
// for the F key.
// onCharacterRemove(id): the tray's Remove button, after its own confirmation.
// onCharacterTokenRemove(id, key): a click on a token in the tray's "On" row.
// onTokenDragStart(e, key, looseId): pointerdown on a tray's Give source, or on a token on the
// table (looseId), the same handler the Tokens panel uses (see App.jsx, handleTokenDragStart).
// looseTokens: the character tokens that lie on the table, [{ id, key, x, z }] (see App.jsx).
// onLooseHover(id, over): the pointer moved onto or off one of them, for the Delete key.
// tokenDrag: the token drag in progress, see App.jsx. While it is active, the dragged token shows
// under the pointer (TokenDragPreview) and, for a token from the table, not in its old place.
// dragPointRef: the preview writes the table point under the pointer there, for App's release.
// onCardOpen({ src, alt }): a click on a crisis card (see CardPopup.jsx). onTrayOpen(id): a click
// on a tray card opens the whole tray (see TrayPopup.jsx).
// diceMenu: the open face menu of a dice tray, { trayKey, symbol } | null, lifted to App so Escape
// can close it. onDiceMenuToggle(trayKey, symbol), onDiceMenuClose(): see DiceKeys.jsx.
// characterAtRef: ref App calls with (clientX, clientY) to find the character under the pointer,
// the same pattern as bodyRef. Scene fills it with its own characterAt (3D only: the model
// or the tray's background plate), used by App's findCharacterAt below.
// findCharacterAt(clientX, clientY): App's own lookup, the DOM tray controls (data-character-id)
// first, then characterAtRef's characterAt. Passed back down so CrisisToken.jsx's Extract-token
// release (Phase 7) uses the same lookup as App's token drag, instead of 3D-only characterAt, so a
// release over the tray's controls strip (DOM) counts too.
// modelPositionRef: ref App calls with a character id to get its live table position { x, z }
// (Rapier body or model object, not the spawn position), or null. Used by App's handleTokenDrop, the
// same pattern as characterAtRef. See "Hold and drop".
// turnPieceRef: ref App calls with a direction for Q / E, the same pattern as characterAtRef. Scene
// fills it with turnPiece. heldRotate: ref to a Map of the Q / E keys held down, key code → direction.
// liftPieceRef: ref App calls for R, the same pattern. Scene fills it with liftPiece.
// onTokenHold(tokenId, characterId, cardPoint): a canHold token was released over a character.
// cardPoint: the tray-local [x, z] on that character's card (trays.js, trayHeldLocal) when the
// release point is on its tray, otherwise null.
// onHeldHover(tokenId, over): the pointer moved onto or off a crisis token that a character holds,
// for the Delete key, the same as onLooseHover.
// onSupplyDragStart(e, cardKey): pointerdown on the supply pile of a Source card (SupplyPile.jsx).
// scoreMarkers, affiliations, onScoreMarkerMove(marker, x, z): the scoring board markers, see
// ScoreBoard.jsx.
export default function Scene({
  mapId, characters = [], activeRange, activeMove, showColliders = false, showLabels = false, matTurns = 0, deployLine = false,
  crisis = { secure: null, extract: null }, tokens = [], selection = null, onSelectionChange, selectedTool = null, onSelectedToolChange, onPieceHover, toolSpawns = { range: 0, move: 0 }, onTokenMove, onTokenTurn, onTokenHold, onHeldHover, onSupplyDragStart, onCharacterDamage, onCharacterPower, onCharacterFlip, onTrayCardHover, onCharacterRemove, onCharacterTokenRemove, onTokenDragStart, looseTokens = [], onLooseHover, tokenDrag = null, dragPointRef, onCardOpen, onTrayOpen, diceMenu = null, onDiceMenuToggle, onDiceMenuClose, characterAtRef, findCharacterAt, modelPositionRef, turnPieceRef, liftPieceRef, heldRotate, scoreMarkers, affiliations, onScoreMarkerMove,
}) {
  const map = MAPS[mapId]
  const tableTexture = useTexture(assetUrl('table.webp'), fitTableTexture)
  const { camera, gl } = useThree()
  // Character id → Rapier body. Tools read and move characters through it.
  const charBodies = useRef(new Map())
  // Character id → 3D object. Tools find the character under the pointer with it.
  const charObjects = useRef(new Map())
  // Character id → the lift of its model, { toggle(), down() }. See CharacterModel.jsx and liftPiece.
  const charLifts = useRef(new Map())
  // Character id → the tray's background plate. characterAt below hits this too, so a drop anywhere
  // on the tray finds the character (see CharacterTray.jsx).
  const trayObjects = useRef(new Map())
  const raycaster = useRef(new Raycaster())
  // Token id → 3D object, and token id → live center getter. The same purpose as charBodies and
  // charObjects, but a token has no Rapier body (see CrisisToken.jsx).
  const tokenObjects = useRef(new Map())
  const tokenCenters = useRef(new Map())
  // Tool ('move' or 'range') → { id, clamp(p) } while its Place is on, else null.
  // A drag of character id keeps its base on that tool (see onPlaceLimit in RulerTool.jsx).
  const placeLimits = useRef({})
  // The pieces that Q / E can turn (turnPiece): the character or tool under the pointer, and the one
  // that is dragged. { kind: 'character' | 'tool', id } | null. The id of a tool is 'range' or 'move'.
  const hoveredPiece = useRef(null)
  const draggedPiece = useRef(null)
  // Tool ('move' or 'range') → its turn(angle), see turnAroundCenter in RulerTool.jsx
  const toolTurns = useRef({})
  // Turns that are not done yet: piece key → { piece, left }, left in radians. See the useFrame below.
  const turnsLeft = useRef(new Map())
  // The piece of the last Q / E press, which a held key turns on, and the time since that press (s)
  const turnHold = useRef({ piece: null, time: 0 })
  const [draggingCharId, setDraggingCharId] = useState(null)
  // The piece that a range tool measures against, { kind, id, mode: 'inRange' | 'outOfRange' } or null.
  // See RangeMark in RulerTool.jsx.
  const [rangeMark, setRangeMark] = useState(null)

  // Nearest character whose model or tray is under the client point (DOM pixels), or null.
  function characterAt(clientX, clientY) {
    const rect = gl.domElement.getBoundingClientRect()
    const ndc = {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1,
    }
    raycaster.current.setFromCamera(ndc, camera)
    let nearestId = null
    let nearestDistance = Infinity
    for (const ch of characters) {
      for (const object of [charObjects.current.get(ch.id), trayObjects.current.get(ch.id)]) {
        const hit = object && raycaster.current.intersectObject(object, true)[0]
        if (hit && hit.distance < nearestDistance) {
          nearestId = ch.id
          nearestDistance = hit.distance
        }
      }
    }
    return nearestId
  }

  // Live table position of a character's model (Hold and drop, "Drop"): the Rapier body when there
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
    if (hold.piece && direction !== 0 && hold.time > ROTATE_HOLD_DELAY) addTurn(hold.piece, direction * ROTATE_RATE * dt)
    const part = 1 - Math.exp(-dt / ROTATE_SMOOTH_TIME)
    for (const [key, turn] of turnsLeft.current) {
      const angle = Math.abs(turn.left) < ROTATE_DONE ? turn.left : turn.left * part
      turn.left -= angle
      applyTurn(turn.piece, angle)
      if (turn.left === 0) turnsLeft.current.delete(key)
    }
  })

  // R press: lifts the character under the pointer, or puts it back down if it is up. With no
  // character under the pointer, every lifted character goes back down. A player lifts a model to
  // see and select a token under it (docs/feature-crisis.md, "Models that cover a token").
  function liftPiece() {
    const piece = hoveredPiece.current
    if (piece?.kind === 'character') charLifts.current.get(piece.id)?.toggle()
    else for (const lift of charLifts.current.values()) lift.down()
  }

  // Props of a tool ('range' or 'move') for turnPiece
  function turnProps(tool) {
    const piece = { kind: 'tool', id: tool }
    return {
      onHover: over => trackPiece(hoveredPiece, piece, over),
      onDrag: on => trackPiece(draggedPiece, piece, on),
      turnRef: turn => { toolTurns.current[tool] = turn },
    }
  }

  // Registered on every render, so the closures above always see the latest characters/objects.
  useEffect(() => {
    if (characterAtRef) characterAtRef.current = characterAt
    if (modelPositionRef) modelPositionRef.current = modelPosition
    if (turnPieceRef) turnPieceRef.current = turnPiece
    if (liftPieceRef) liftPieceRef.current = liftPiece
  })

  // Tray position of every character (trays.js). A player's row recenters when that player adds
  // or removes a character, so these positions change then.
  const trayPositions = useMemo(() => layoutTrays(characters), [characters])
  // Tray positions of the last layout, to find the trays that moved.
  const lastTrayPositions = useRef(new Map())
  // A model that still stands on its tray moves with the tray, the same as TTS (moveTray in the
  // tray script). A model that the player moved off its tray, for example onto the mat, stays.
  useEffect(() => {
    for (const [id, pos] of trayPositions) {
      const last = lastTrayPositions.current.get(id)
      const body = charBodies.current.get(id)
      if (!last || !body || (last[0] === pos[0] && last[2] === pos[2])) continue
      const t = body.translation()
      if (onTray(last, t)) body.setTranslation({ x: t.x + pos[0] - last[0], y: t.y, z: t.z + pos[2] - last[2] }, true)
    }
    lastTrayPositions.current = trayPositions
  }, [trayPositions])

  const selectedCharId = selection?.kind === 'character' ? selection.id : null
  const selectedTokenId = selection?.kind === 'token' ? selection.id : null

  // Deploy-line: R3 zone depth from the deployment edge
  const deployTip = RANGE_TIP[3]
  const deployDepth = 2 * deployTip
  const draggingChar = deployLine && draggingCharId ? characters.find(ch => ch.id === draggingCharId) : null

  // Every character and every mat token as the range and movement tools see them. A character has a
  // Rapier body; a token does not, so getCenter (not getBody) is what the tools measure with.
  // getBody is only used where a tool moves a piece (Place), and Place is disabled for a token.
  // A held token is not in this list: it is off the mat, on its holder's tray (see "Hold and drop").
  const matTokens = useMemo(() => tokens.filter(tok => !tok.heldBy), [tokens])
  // Every crisis token as it is drawn. A held token lies on its holder's card: its tray-local place
  // (heldAt) moves to the table with the tray position, and it faces the holder's player, the same
  // as the card (see trays.js, "An objective token that the character holds").
  const tokenViews = useMemo(() => {
    const stacks = new Map()
    return tokens.map(tok => {
      if (!tok.heldBy) return { token: tok }
      const holder = characters.find(ch => ch.id === tok.heldBy)
      const trayPos = trayPositions.get(tok.heldBy)
      if (!holder || !trayPos) return { token: tok }
      const [x, z] = trayHeldWorld(holder.teamColor, trayPos, tok.heldAt)
      const level = stacks.get(tok.heldBy) ?? 0
      stacks.set(tok.heldBy, level + 1)
      return { token: { ...tok, x, z, yaw: trayYaw(holder.teamColor) }, floorY: TRAY_Y + level * HELD_STACK_STEP }
    })
  }, [tokens, characters, trayPositions])
  const toolModels = useMemo(() => [
    ...characters.map(ch => ({
      kind: 'character',
      id: ch.id,
      getBody: () => charBodies.current.get(ch.id),
      getObject: () => charObjects.current.get(ch.id),
      getCenter: () => charBodies.current.get(ch.id)?.translation() ?? { x: 0, y: 0, z: 0 },
      radius: BASE_DIAMETER[ch.base] / 2,
    })),
    ...matTokens.map(tok => ({
      kind: 'token',
      id: tok.id,
      getObject: () => tokenObjects.current.get(tok.id),
      getCenter: () => tokenCenters.current.get(tok.id)?.() ?? { x: tok.x, y: 0, z: tok.z },
      radius: 0.5,
    })),
  ], [characters, matTokens])
  const toolTarget = toolModels.find(model => selection && model.kind === selection.kind && model.id === selection.id)

  // Outline mode of the range mark on a piece, or null
  function rangeMarkOf(kind, id) {
    return rangeMark?.kind === kind && rangeMark.id === id ? rangeMark.mode : null
  }

  function toggleTool(tool) {
    onSelectedToolChange(prev => prev === tool ? null : tool)
  }

  function toggleSelect(kind, id) {
    onSelectionChange(prev => (prev?.kind === kind && prev.id === id) ? null : { kind, id })
  }

  return (
    <>
      {/* Space background */}
      <color attach="background" args={['#050510']} />
      <Stars radius={200} depth={60} count={5000} factor={4} fade speed={0.5} />

      <ambientLight intensity={0.85} />
      {/* The shadow camera looks from the light to the origin, so its x axis runs along the world
          diagonal (x − z), not along world x. The bounds are the mat and both dice trays measured in
          that camera's space: the mat needs x ±25.5, y −23 to 24.7, and the trays reach x = 37.1 and
          y = −33.5. The map is 3072 so that one shadow pixel is about as small as before
          (64" / 3072 ≈ 40" / 2048). */}
      <directionalLight
        position={[10, 30, 10]}
        intensity={0.8}
        castShadow
        shadow-mapSize={[3072, 3072]}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-camera-left={-26}
        shadow-camera-right={38}
        shadow-camera-top={25}
        shadow-camera-bottom={-34}
      />
      {/* Same HDR as drei's "city" preset, served with the app instead of from a CDN.
          The light multiplies the texture color. Per unit of intensity, a surface that faces up gets:
          HDR 1.35 (its cos-weighted sky average), directional 0.29, ambient 0.32. A side face gets
          HDR 0.35–0.66, directional 0–0.14, ambient 0.32. ACES tone mapping shows mid tones at their
          texture color when the total is about 0.9. A total of 1.21 (HDR 0.5, directional 1.2, ambient 0.6)
          looked like a strong lamp. Most HDR light comes from above, so it makes tops much brighter than
          sides. Ambient is the same from every side, so part of the light moved from the HDR to ambient.
          Now a face up gets 0.41 + 0.23 + 0.27 = 0.91, and a side face 0.38–0.55. */}
      <Environment files={assetUrl('hdri/potsdamer_platz_1k.hdr')} backgroundIntensity={0} environmentIntensity={0.3} />

      <Physics gravity={[0, WORLD_GRAVITY, 0]} timeStep={TIME_STEP} debug={showColliders}>
        {/* Table surface — fixed collider so models land on it */}
        <RigidBody type="fixed" colliders={false}>
          {/* Collider much thicker than the visual so fast bodies can't tunnel through; top stays at y=0 */}
          <CuboidCollider
            args={[TABLE_WIDTH / 2, TABLE_COLLIDER_HALF_H, TABLE_DEPTH / 2]}
            position={[0, -TABLE_COLLIDER_HALF_H, 0]}
            friction={FRICTION}
          />
          <mesh position={[0, -TABLE_THICKNESS / 2, 0]} receiveShadow>
            <boxGeometry args={[TABLE_WIDTH, TABLE_THICKNESS, TABLE_DEPTH]} />
            <meshStandardMaterial map={tableTexture} roughness={0.8} metalness={0.05} onBeforeCompile={projectFootprints} />
          </mesh>
        </RigidBody>
        {/* Invisible walls at the table edge, so dice cannot fall off the table. Kinematic, see table.js. */}
        <RigidBody type="kinematicPosition" colliders={false}>
          {TABLE_WALLS.map(({ halfExtents, position }, i) => (
            <CuboidCollider key={i} args={halfExtents} position={position} friction={FRICTION} />
          ))}
        </RigidBody>

        {/* The mat and its terrain turn together around the mat center. In game setup, the player with priority
            turns them so that the deployment edge they chose faces the blue side. */}
        <group rotation={[0, matTurns * Math.PI / 2, 0]}>
          <Suspense fallback={null}>
            <Mat mat={map.mat} />
          </Suspense>
          {/* A fixed body does not follow its parent after it is created. So each turn mounts the terrain again,
              and its colliders are created at the new pose. A new map also mounts it again. */}
          <Suspense key={`${mapId}-${matTurns}`} fallback={null}>
            <Terrain placements={map.placements} showLabels={showLabels} />
          </Suspense>
        </group>

        {/* Dice trays are relative to the table, not the mat: not keyed by mapId or matTurns, so a
            map change or a mat turn (which remounts Terrain above) never remounts them and their
            dice keep their state. See docs/plan-dice-rolling.md, Phase 4. */}
        {Object.keys(TRAYS).map(trayKey => (
          <DiceTray
            key={trayKey}
            trayKey={trayKey}
            openMenuSymbol={diceMenu?.trayKey === trayKey ? diceMenu.symbol : null}
            onMenuToggle={symbol => onDiceMenuToggle(trayKey, symbol)}
            onMenuClose={onDiceMenuClose}
          />
        ))}

        {/* The scoring board is relative to the table, the same as the dice trays */}
        <ScoreBoard markers={scoreMarkers} affiliations={affiliations} onMarkerMove={onScoreMarkerMove} />

        {/* Crisis cards and tokens are relative to the player sides, not the mat, so they stay
            outside the rotating group above: a mat turn must not turn them. See docs/feature-crisis.md. */}
        {crisis.secure && (
          <Suspense fallback={null}>
            <CrisisCard cardKey={crisis.secure} position={[CARD_X, CARD_Y, CARD_Z.secure]} onOpen={onCardOpen} />
          </Suspense>
        )}
        {crisis.extract && (
          <Suspense fallback={null}>
            <CrisisCard cardKey={crisis.extract} position={[CARD_X, CARD_Y, CARD_Z.extract]} onOpen={onCardOpen} />
          </Suspense>
        )}
        {/* The supply pile of a Source card (only Extract cards have one now) */}
        {Object.entries(crisis).map(([type, key]) => {
          const supply = getCard(key)?.supply
          return supply && (
            <SupplyPile
              key={type}
              tokenKey={supply}
              position={supplyPilePosition(type)}
              onDragStart={e => onSupplyDragStart(e, key)}
            />
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
              onSelect={() => toggleSelect('token', tok.id)}
              onHover={tok.heldBy ? over => onHeldHover?.(tok.id, over) : over => onPieceHover?.({ kind: 'token', id: tok.id }, over)}
              onMove={(x, z) => onTokenMove(tok.id, x, z)}
              onTurn={yaw => onTokenTurn(tok.id, yaw)}
              onHold={(characterId, point) => {
                const holder = characters.find(ch => ch.id === characterId)
                const trayPos = trayPositions.get(characterId)
                const onCard = holder && trayPos && onTray(trayPos, point)
                onTokenHold(tok.id, characterId, onCard ? trayHeldLocal(holder.teamColor, trayPos, point) : null)
              }}
              findCharacter={findCharacterAt}
              objectRef={obj => obj ? tokenObjects.current.set(tok.id, obj) : tokenObjects.current.delete(tok.id)}
              centerRef={fn => fn ? tokenCenters.current.set(tok.id, fn) : tokenCenters.current.delete(tok.id)}
            />
          </Suspense>
        ))}

        {/* Character tokens on the table. Relative to the table, not the mat, the same as the crisis
            tokens above. A token that is being dragged shows under the pointer instead. */}
        {looseTokens.filter(tok => !(tokenDrag?.active && tokenDrag.looseId === tok.id)).map(tok => (
          <LooseToken
            key={tok.id}
            token={tok}
            onDragStart={e => onTokenDragStart(e, tok.key, tok.id)}
            onHover={over => onLooseHover?.(tok.id, over)}
          />
        ))}
        {tokenDrag?.active && (
          <TokenDragPreview pointRef={dragPointRef} start={tokenDrag.start}>
            {tokenDrag.supplyCard
              ? <SupplyToken tokenKey={tokenDrag.tokenKey} raycast={NO_RAYCAST} />
              : <TokenFace tokenKey={tokenDrag.tokenKey} interactive={false} />}
          </TokenDragPreview>
        )}

        {/* One tray per spawned character, next to the mat edge (see trays.js and
            docs/characters-hud.md, "Tray layout"). The model below spawns standing on the center
            of this tray's card (trayModelPosition). It reads that position only once, when its
            body mounts, so a later tray move does not teleport it. */}
        {characters.map(ch => (
          <Suspense key={ch.id} fallback={null}>
            <CharacterTray
              character={ch}
              position={trayPositions.get(ch.id)}
              onOpen={() => onTrayOpen(ch.id)}
              onDamage={damage => onCharacterDamage(ch.id, damage)}
              onPower={power => onCharacterPower(ch.id, power)}
              onFlip={() => onCharacterFlip(ch.id)}
              onCardHover={over => onTrayCardHover?.(ch.id, over)}
              onRemove={() => onCharacterRemove(ch.id)}
              onTokenRemove={key => onCharacterTokenRemove(ch.id, key)}
              onTokenDragStart={onTokenDragStart}
              selected={selectedCharId === ch.id}
              objectRef={obj => obj ? trayObjects.current.set(ch.id, obj) : trayObjects.current.delete(ch.id)}
            />
          </Suspense>
        ))}

        {characters.map(ch => (
          <Suspense key={ch.id} fallback={null}>
            {ch.figure === 'standee' ? (
              <Character
                position={trayModelPosition(ch.teamColor, trayPositions.get(ch.id))}
                baseSize={ch.base}
                frontUrl={assetUrl(characterStandee(ch.key, 'front'))}
                backUrl={assetUrl(characterStandee(ch.key, 'back'))}
              />
            ) : (
              <CharacterModel
                url={assetUrl(characterModel(ch.key))}
                position={trayModelPosition(ch.teamColor, trayPositions.get(ch.id))}
                baseRadius={BASE_DIAMETER[ch.base] / 2}
                rotation={[0, ch.rotation * Math.PI / 180, 0]}
                teamColor={ch.teamColor}
                selected={selectedCharId === ch.id}
                rangeMark={rangeMarkOf('character', ch.id)}
                onSelect={() => toggleSelect('character', ch.id)}
                onHover={over => {
                  onPieceHover?.({ kind: 'character', id: ch.id }, over)
                  trackPiece(hoveredPiece, { kind: 'character', id: ch.id }, over)
                }}
                bodyRef={rb => rb ? charBodies.current.set(ch.id, rb) : charBodies.current.delete(ch.id)}
                objectRef={obj => obj ? charObjects.current.set(ch.id, obj) : charObjects.current.delete(ch.id)}
                liftRef={lift => lift ? charLifts.current.set(ch.id, lift) : charLifts.current.delete(ch.id)}
                onDragStart={() => {
                  setDraggingCharId(ch.id)
                  trackPiece(draggedPiece, { kind: 'character', id: ch.id }, true)
                }}
                onDragEnd={() => {
                  setDraggingCharId(null)
                  trackPiece(draggedPiece, { kind: 'character', id: ch.id }, false)
                }}
                // A base is within range if any part of it is within range (p8). So the base can
                // go as far as touching the far end of the tool: its center is one radius past it.
                constrainDrag={(p) => {
                  if (deployLine) {
                    const limit = MAT_SIZE / 2 - deployDepth - BASE_DIAMETER[ch.base] / 2
                    if (ch.teamColor === 'blue') p.z = Math.max(p.z, limit)
                    else p.z = Math.min(p.z, -limit)
                  }
                  for (const limit of Object.values(placeLimits.current)) {
                    if (limit?.id === ch.id) limit.clamp(p)
                  }
                }}
              />
            )}
          </Suspense>
        ))}

        {activeMove && (
          <Suspense key={`${activeMove}-${toolSpawns.move}`} fallback={null}>
            <MovementRuler
              type={activeMove}
              team={TOOL_TEAM}
              position={[0, TOOL_HOVER_HEIGHT, -6]}
              hoverHeight={TOOL_HOVER_HEIGHT}
              selected={selectedTool === 'move'}
              onSelect={() => toggleTool('move')}
              // A new tool is selected, so its buttons (Place, Bend) can be used right away
              onSpawn={() => onSelectedToolChange('move')}
              target={toolTarget}
              models={toolModels}
              onSnap={model => onSelectionChange({ kind: model.kind, id: model.id })}
              onPlaceLimit={limit => { placeLimits.current.move = limit }}
              {...turnProps('move')}
            />
          </Suspense>
        )}
        {draggingChar && (
          <Suspense fallback={null}>
            <DeployRangeTool
              getBody={() => charBodies.current.get(draggingCharId)}
              centerZ={draggingChar.teamColor === 'blue' ? MAT_SIZE / 2 - deployTip : -(MAT_SIZE / 2 - deployTip)}
              yaw={draggingChar.teamColor === 'blue' ? -Math.PI / 2 : Math.PI / 2}
              team={draggingChar.teamColor}
              hoverHeight={TOOL_HOVER_HEIGHT}
            />
          </Suspense>
        )}
        {activeRange && (
          <Suspense key={`${activeRange}-${toolSpawns.range}`} fallback={null}>
            <RangeRuler
              number={activeRange}
              team={TOOL_TEAM}
              position={[0, TOOL_HOVER_HEIGHT, 6]}
              hoverHeight={TOOL_HOVER_HEIGHT}
              selected={selectedTool === 'range'}
              onSelect={() => toggleTool('range')}
              onSpawn={() => onSelectedToolChange('range')}
              target={toolTarget}
              models={toolModels}
              onSnap={model => onSelectionChange({ kind: model.kind, id: model.id })}
              onPlaceLimit={limit => { placeLimits.current.range = limit }}
              onRangeMark={setRangeMark}
              {...turnProps('range')}
            />
          </Suspense>
        )}
      </Physics>
    </>
  )
}
