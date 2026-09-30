import { useMemo, useRef, useState } from 'react'
import { useTexture, Stars, Environment } from '@react-three/drei'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { MovementRuler, RangeRuler, DeployRangeTool, RANGE_TIP } from './RulerTool.jsx'
import CharacterModel from './CharacterModel.jsx'
import Character from './Character.jsx'
import Terrain from './Terrain.jsx'
import CrisisCard from './CrisisCard.jsx'
import CrisisToken from './CrisisToken.jsx'
import { projectFootprints } from './footprintProjection.js'
import { matImage } from '../terrain/files.js'
import { characterModel, characterStandee, BASE_DIAMETER } from '../characters/files.js'
import { MAPS } from '../terrain/maps.js'
import { FRICTION } from '../physics.js'
import { assetUrl } from '../assets/index.js'
import { CARD_X, CARD_Y, CARD_Z } from '../crisis/layout.js'

// MCP mat is 36" x 36". 1 Three.js unit = 1 inch.
// The table is 72" wide (x) and 48" deep (z), the same 3:2 shape as the TTS table. It is wider than deep so that
// the scoring board and the crisis cards fit next to the mat, at their TTS positions.
const MAT_SIZE = 36
const TABLE_WIDTH = 72
const TABLE_DEPTH = 48
const TABLE_THICKNESS = 0.5
const TABLE_COLLIDER_HALF_H = 5
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
export default function Scene({
  mapId, characters = [], activeRange, activeMove, showColliders = false, showLabels = false, matTurns = 0, deployLine = false,
  crisis = { secure: null, extract: null }, tokens = [], selection = null, onSelectionChange, onTokenMove, onTokenTurn, onCardOpen,
}) {
  const map = MAPS[mapId]
  const matTexture = useTexture(assetUrl(matImage(map.mat)))
  // One tool can be selected at the same time as a character or a token
  const [selectedToolId, setSelectedToolId] = useState(null)
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

  function toggleTool(toolId) {
    setSelectedToolId(prev => prev === toolId ? null : toolId)
  }

  function toggleSelect(kind, id) {
    onSelectionChange(prev => (prev?.kind === kind && prev.id === id) ? null : { kind, id })
  }

  return (
    <>
      {/* Space background */}
      <color attach="background" args={['#050510']} />
      <Stars radius={200} depth={60} count={5000} factor={4} fade speed={0.5} />

      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 30, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
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
            key={activeMove}
            type={activeMove}
            position={[0, TOOL_HOVER_HEIGHT, -6]}
            hoverHeight={TOOL_HOVER_HEIGHT}
            selected={selectedToolId === 'move'}
            onSelect={() => toggleTool('move')}
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
            key={activeRange}
            number={activeRange}
            position={[0, TOOL_HOVER_HEIGHT, 6]}
            hoverHeight={TOOL_HOVER_HEIGHT}
            selected={selectedToolId === 'range'}
            onSelect={() => toggleTool('range')}
            target={toolTarget}
            models={toolModels}
            onSnap={model => onSelectionChange({ kind: model.kind, id: model.id })}
          />
        )}
      </Physics>
    </>
  )
}
