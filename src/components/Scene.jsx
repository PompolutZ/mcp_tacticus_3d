import { useMemo, useRef, useState } from 'react'
import { useTexture, Stars, Environment } from '@react-three/drei'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { MovementRuler, RangeRuler } from './RulerTool.jsx'
import CharacterModel, { BASE_RADIUS } from './CharacterModel.jsx'
import Terrain from './Terrain.jsx'
import { projectFootprints } from './footprintProjection.js'
import { MAPS } from '../terrain/maps.js'
import { FRICTION } from '../physics.js'
import { assetUrl } from '../assets/index.js'

// MCP mat is 36" x 36". Table is larger — 48" x 48" in the same unit space.
// 1 Three.js unit = 1 inch. Mat = 36 x 36, table = 48 x 48.
const MAT_SIZE = 36
const TABLE_SIZE = 48
const TABLE_THICKNESS = 0.5
const TABLE_COLLIDER_HALF_H = 5
// Blue half is the side of the player who won the priority roll-off. Red half is the other player's side.
// Blue is at +z, the bottom of the default camera view.
const TABLE_HALVES = [
  { color: '#6fa0e0', z: TABLE_SIZE / 4 },
  { color: '#e07272', z: -TABLE_SIZE / 4 },
]
const DROP_HEIGHT = 15
// Tools hang this far above the table and measure by the outline cast below them
const TOOL_HOVER_HEIGHT = 1
// Two physics steps per frame. With one, a model dropped from high up sometimes gets stuck in terrain.
const TIME_STEP = 1 / 120

// mapId: key in MAPS
// showColliders: draw every physics collider as lines (the shapes physics uses, not the visible meshes)
// matTurns: number of 90° counter-clockwise turns of the mat and its terrain
export default function Scene({ mapId, activeRange, activeMove, showColliders = false, matTurns = 0 }) {
  const map = MAPS[mapId]
  const matTexture = useTexture(map.mat)
  // One character and one tool can be selected at the same time
  const [selectedCharId, setSelectedCharId] = useState(null)
  const [selectedToolId, setSelectedToolId] = useState(null)
  const [characters] = useState([
    { id: 'angel-1', url: assetUrl('angel.glb'), position: [0, DROP_HEIGHT, 0], teamColor: 'red', scale: 1 },
  ])
  // Character id → Rapier body. Tools read and move characters through it.
  const charBodies = useRef(new Map())
  // Character id → 3D object. Tools find the character under the pointer with it.
  const charObjects = useRef(new Map())

  // Every character as tools see it
  const toolModels = useMemo(() => characters.map(ch => ({
    id: ch.id,
    getBody: () => charBodies.current.get(ch.id),
    getObject: () => charObjects.current.get(ch.id),
    radius: BASE_RADIUS * ch.scale,
    scale: ch.scale,
  })), [characters])
  const toolTarget = toolModels.find(model => model.id === selectedCharId)

  function toggleTool(toolId) {
    setSelectedToolId(prev => prev === toolId ? null : toolId)
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
            args={[TABLE_SIZE / 2, TABLE_COLLIDER_HALF_H, TABLE_SIZE / 2]}
            position={[0, -TABLE_COLLIDER_HALF_H, 0]}
            friction={FRICTION}
          />
          {TABLE_HALVES.map(({ color, z }) => (
            <mesh key={color} position={[0, -TABLE_THICKNESS / 2, z]} receiveShadow>
              <boxGeometry args={[TABLE_SIZE, TABLE_THICKNESS, TABLE_SIZE / 2]} />
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
          <Terrain key={`${mapId}-${matTurns}`} placements={map.placements} />
        </group>

        {characters.map(ch => (
          <CharacterModel
            key={ch.id}
            url={ch.url}
            position={ch.position}
            scale={ch.scale}
            teamColor={ch.teamColor}
            selected={selectedCharId === ch.id}
            onSelect={() => setSelectedCharId(prev => prev === ch.id ? null : ch.id)}
            bodyRef={rb => rb ? charBodies.current.set(ch.id, rb) : charBodies.current.delete(ch.id)}
            objectRef={obj => obj ? charObjects.current.set(ch.id, obj) : charObjects.current.delete(ch.id)}
          />
        ))}

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
            onSnap={model => setSelectedCharId(model.id)}
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
            onSnap={model => setSelectedCharId(model.id)}
          />
        )}
      </Physics>
    </>
  )
}
