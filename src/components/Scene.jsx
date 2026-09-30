import { useMemo, useRef, useState } from 'react'
import { useTexture, Stars, Environment } from '@react-three/drei'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { MovementRuler, RangeRuler, DeployRangeTool, RANGE_TIP } from './RulerTool.jsx'
import CharacterModel from './CharacterModel.jsx'
import Character from './Character.jsx'
import Terrain from './Terrain.jsx'
import CrisisCard from './CrisisCard.jsx'
import CrisisToken from './CrisisToken.jsx'
import DiceTray from './DiceTray.jsx'
import { projectFootprints } from './footprintProjection.js'
import { matImage } from '../terrain/files.js'
import { characterModel, characterStandee, BASE_DIAMETER } from '../characters/files.js'
import { MAPS } from '../terrain/maps.js'
import { FRICTION } from '../physics.js'
import { assetUrl } from '../assets/index.js'
import { CARD_X, CARD_Y, CARD_Z } from '../crisis/layout.js'
import { TRAYS } from '../dice/tray.js'
import { TABLE_COLLIDER_HALF_H, TABLE_DEPTH, TABLE_WALLS, TABLE_WIDTH } from '../table.js'

// MCP mat is 36" x 36". 1 Three.js unit = 1 inch. Table size: see table.js.
const MAT_SIZE = 36
const TABLE_THICKNESS = 0.5
// Blue half is the side of the player who won the priority roll-off. Red half is the other player's side.
// Blue is at +z, the bottom of the default camera view.
const TABLE_HALVES = [
  { color: '#6fa0e0', z: TABLE_DEPTH / 4 },
  { color: '#e07272', z: -TABLE_DEPTH / 4 },
]
// Spawned models stand on the table in front of their player's mat edge, in rows along that edge.
// The strip between the mat and the table edge is 6" deep, so two rows of the largest base (2.56") fit.
const BENCH_SPACING = 3
const BENCH_COLUMNS = MAT_SIZE / BENCH_SPACING
const BENCH_ROWS = 2

// Table position of spawn slot n (from 0) of a player. The row fills from that player's left.
// y = 0 is the table top, and the body origin is the base bottom, so the model stands and does not fall.
function benchPosition(teamColor, slot) {
  const col = slot % BENCH_COLUMNS
  const row = Math.floor(slot / BENCH_COLUMNS) % BENCH_ROWS
  const x = (col - (BENCH_COLUMNS - 1) / 2) * BENCH_SPACING
  const z = MAT_SIZE / 2 + BENCH_SPACING / 2 + row * BENCH_SPACING
  // Blue sits at +z, red at -z. Turning the layout 180° gives red the same order from its own seat.
  const side = teamColor === 'blue' ? 1 : -1
  return [x * side, 0, z * side]
}
// Tools hang this far above the table and measure by the outline cast below them
const TOOL_HOVER_HEIGHT = 1
// Two physics steps per frame. With one, a model dropped from high up sometimes gets stuck in terrain.
const TIME_STEP = 1 / 120

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
// trayActionsRef: ref to a Map, tray key -> its add/remove/roll/clear actions (App does not pass
// this yet; wired in Phase 5, the same pattern as charBodies below but owned by App because the
// HUD panel that calls these actions is outside the canvas).
// onTrayChange(trayKey, state): called when a tray's reported state changes (also Phase 5).
export default function Scene({
  mapId, characters = [], activeRange, activeMove, showColliders = false, showLabels = false, matTurns = 0, deployLine = false,
  crisis = { secure: null, extract: null }, tokens = [], selection = null, onSelectionChange, selectedTool = null, onSelectedToolChange, onPieceHover, toolSpawns = { range: 0, move: 0 }, onTokenMove, onTokenTurn, onCardOpen, trayActionsRef, onTrayChange,
}) {
  const map = MAPS[mapId]
  const matTexture = useTexture(assetUrl(matImage(map.mat)))
  // Character id → Rapier body. Tools read and move characters through it.
  const charBodies = useRef(new Map())
  // Character id → 3D object. Tools find the character under the pointer with it.
  const charObjects = useRef(new Map())
  // Token id → 3D object, and token id → live center getter. The same purpose as charBodies and
  // charObjects, but a token has no Rapier body (see CrisisToken.jsx).
  const tokenObjects = useRef(new Map())
  const tokenCenters = useRef(new Map())
  const [draggingCharId, setDraggingCharId] = useState(null)

  const selectedCharId = selection?.kind === 'character' ? selection.id : null
  const selectedTokenId = selection?.kind === 'token' ? selection.id : null

  // Deploy-line: R3 zone depth from the deployment edge
  const deployTip = RANGE_TIP[3]
  const deployDepth = 2 * deployTip
  const draggingChar = deployLine && draggingCharId ? characters.find(ch => ch.id === draggingCharId) : null

  // Every character and every token as the range and movement tools see them. A character has a
  // Rapier body; a token does not, so getCenter (not getBody) is what the tools measure with.
  // getBody is only used where a tool moves a piece (Place), and Place is disabled for a token.
  const toolModels = useMemo(() => [
    ...characters.map(ch => ({
      kind: 'character',
      id: ch.id,
      getBody: () => charBodies.current.get(ch.id),
      getObject: () => charObjects.current.get(ch.id),
      getCenter: () => charBodies.current.get(ch.id)?.translation() ?? { x: 0, y: 0, z: 0 },
      radius: BASE_DIAMETER[ch.base] / 2,
    })),
    ...tokens.map(tok => ({
      kind: 'token',
      id: tok.id,
      getObject: () => tokenObjects.current.get(tok.id),
      getCenter: () => tokenCenters.current.get(tok.id)?.() ?? { x: tok.x, y: 0, z: tok.z },
      radius: 0.5,
    })),
  ], [characters, tokens])
  const toolTarget = toolModels.find(model => selection && model.kind === selection.kind && model.id === selection.id)

  function toggleTool(tool) {
    onSelectedToolChange(prev => prev === tool ? null : tool)
  }

  function toggleSelect(kind, id) {
    onSelectionChange(prev => (prev?.kind === kind && prev.id === id) ? null : { kind, id })
  }

  // Registers a tray's actions in the parent's ref map, the same shape as bodyRef/objectRef
  // above, called with null on unmount.
  function registerTrayActions(trayKey, actions) {
    if (!trayActionsRef) return
    if (actions) trayActionsRef.current.set(trayKey, actions)
    else trayActionsRef.current.delete(trayKey)
  }

  return (
    <>
      {/* Space background */}
      <color attach="background" args={['#050510']} />
      <Stars radius={200} depth={60} count={5000} factor={4} fade speed={0.5} />

      <ambientLight intensity={0.6} />
      {/* The shadow camera looks from the light to the origin, so its x axis runs along the world
          diagonal (x − z), not along world x. The bounds are the mat and both dice trays measured in
          that camera's space: the mat needs x ±25.5, y −23 to 24.7, and the trays reach x = 37.1 and
          y = −33.5. The map is 3072 so that one shadow pixel is about as small as before
          (64" / 3072 ≈ 40" / 2048). */}
      <directionalLight
        position={[10, 30, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[3072, 3072]}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-camera-left={-26}
        shadow-camera-right={38}
        shadow-camera-top={25}
        shadow-camera-bottom={-34}
      />
      {/* Same HDR as drei's "city" preset, served with the app instead of from a CDN */}
      <Environment files={assetUrl('hdri/potsdamer_platz_1k.hdr')} backgroundIntensity={0} />

      <Physics gravity={[0, -30, 0]} timeStep={TIME_STEP} debug={showColliders}>
        {/* Table surface — fixed collider so models land on it */}
        <RigidBody type="fixed" colliders={false}>
          {/* Collider much thicker than the visual so fast bodies can't tunnel through; top stays at y=0 */}
          <CuboidCollider
            args={[TABLE_WIDTH / 2, TABLE_COLLIDER_HALF_H, TABLE_DEPTH / 2]}
            position={[0, -TABLE_COLLIDER_HALF_H, 0]}
            friction={FRICTION}
          />
          {TABLE_HALVES.map(({ color, z }) => (
            <mesh key={color} position={[0, -TABLE_THICKNESS / 2, z]} receiveShadow>
              <boxGeometry args={[TABLE_WIDTH, TABLE_THICKNESS, TABLE_DEPTH / 2]} />
              <meshStandardMaterial color={color} roughness={0.8} metalness={0.05} onBeforeCompile={projectFootprints} />
            </mesh>
          ))}
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
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[MAT_SIZE, MAT_SIZE]} />
            <meshStandardMaterial map={matTexture} roughness={1} metalness={0} onBeforeCompile={projectFootprints} />
          </mesh>
          {/* A fixed body does not follow its parent after it is created. So each turn mounts the terrain again,
              and its colliders are created at the new pose. A new map also mounts it again. */}
          <Terrain key={`${mapId}-${matTurns}`} placements={map.placements} showLabels={showLabels} />
        </group>

        {/* Dice trays are relative to the table, not the mat: not keyed by mapId or matTurns, so a
            map change or a mat turn (which remounts Terrain above) never remounts them and their
            dice keep their state. See docs/plan-dice-rolling.md, Phase 4. */}
        {Object.keys(TRAYS).map(trayKey => (
          <DiceTray key={trayKey} trayKey={trayKey} actionsRef={registerTrayActions} onChange={onTrayChange} />
        ))}

        {/* Crisis cards and tokens are relative to the player sides, not the mat, so they stay
            outside the rotating group above: a mat turn must not turn them. See docs/feature-crisis.md. */}
        {crisis.secure && (
          <CrisisCard cardKey={crisis.secure} position={[CARD_X, CARD_Y, CARD_Z.secure]} onOpen={() => onCardOpen(crisis.secure)} />
        )}
        {crisis.extract && (
          <CrisisCard cardKey={crisis.extract} position={[CARD_X, CARD_Y, CARD_Z.extract]} onOpen={() => onCardOpen(crisis.extract)} />
        )}
        {tokens.map(tok => (
          <CrisisToken
            key={tok.id}
            token={tok}
            selected={selectedTokenId === tok.id}
            onSelect={() => toggleSelect('token', tok.id)}
            onHover={over => onPieceHover?.({ kind: 'token', id: tok.id }, over)}
            onMove={(x, z) => onTokenMove(tok.id, x, z)}
            onTurn={yaw => onTokenTurn(tok.id, yaw)}
            objectRef={obj => obj ? tokenObjects.current.set(tok.id, obj) : tokenObjects.current.delete(tok.id)}
            centerRef={fn => fn ? tokenCenters.current.set(tok.id, fn) : tokenCenters.current.delete(tok.id)}
          />
        ))}

        {characters.map(ch => {
          if (ch.figure === 'standee') {
            return (
              <Character
                key={ch.id}
                position={benchPosition(ch.teamColor, ch.slot)}
                baseSize={ch.base}
                frontUrl={assetUrl(characterStandee(ch.key, 'front'))}
                backUrl={assetUrl(characterStandee(ch.key, 'back'))}
              />
            )
          }
          return (
            <CharacterModel
              key={ch.id}
              url={assetUrl(characterModel(ch.key))}
              position={benchPosition(ch.teamColor, ch.slot)}
              baseRadius={BASE_DIAMETER[ch.base] / 2}
              rotation={[0, ch.rotation * Math.PI / 180, 0]}
              teamColor={ch.teamColor}
              selected={selectedCharId === ch.id}
              onSelect={() => toggleSelect('character', ch.id)}
              onHover={over => onPieceHover?.({ kind: 'character', id: ch.id }, over)}
              bodyRef={rb => rb ? charBodies.current.set(ch.id, rb) : charBodies.current.delete(ch.id)}
              objectRef={obj => obj ? charObjects.current.set(ch.id, obj) : charObjects.current.delete(ch.id)}
              onDragStart={() => setDraggingCharId(ch.id)}
              onDragEnd={() => setDraggingCharId(null)}
              constrainDrag={deployLine ? (p) => {
                if (ch.teamColor === 'blue') p.z = Math.max(p.z, MAT_SIZE / 2 - deployDepth)
                else p.z = Math.min(p.z, -(MAT_SIZE / 2 - deployDepth))
              } : undefined}
            />
          )
        })}

        {activeMove && (
          <MovementRuler
            key={`${activeMove}-${toolSpawns.move}`}
            type={activeMove}
            position={[0, TOOL_HOVER_HEIGHT, -6]}
            hoverHeight={TOOL_HOVER_HEIGHT}
            selected={selectedTool === 'move'}
            onSelect={() => toggleTool('move')}
            // A new tool is selected, so its buttons (Place, Bend) can be used right away
            onSpawn={() => onSelectedToolChange('move')}
            target={toolTarget}
            models={toolModels}
            onSnap={model => onSelectionChange({ kind: model.kind, id: model.id })}
          />
        )}
        {draggingChar && (
          <DeployRangeTool
            getBody={() => charBodies.current.get(draggingCharId)}
            centerZ={draggingChar.teamColor === 'blue' ? MAT_SIZE / 2 - deployTip : -(MAT_SIZE / 2 - deployTip)}
            yaw={draggingChar.teamColor === 'blue' ? -Math.PI / 2 : Math.PI / 2}
            hoverHeight={TOOL_HOVER_HEIGHT}
          />
        )}
        {activeRange && (
          <RangeRuler
            key={`${activeRange}-${toolSpawns.range}`}
            number={activeRange}
            position={[0, TOOL_HOVER_HEIGHT, 6]}
            hoverHeight={TOOL_HOVER_HEIGHT}
            selected={selectedTool === 'range'}
            onSelect={() => toggleTool('range')}
            onSpawn={() => onSelectedToolChange('range')}
            target={toolTarget}
            models={toolModels}
            onSnap={model => onSelectionChange({ kind: model.kind, id: model.id })}
          />
        )}
      </Physics>
    </>
  )
}
