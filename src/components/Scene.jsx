import { useMemo, useRef, useState } from 'react'
import { useTexture, Stars, Environment } from '@react-three/drei'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { MovementRuler, RangeRuler } from './RulerTool.jsx'
import CharacterModel, { BASE_RADIUS } from './CharacterModel.jsx'
import Terrain from './Terrain.jsx'
import { MAPS } from '../terrain/maps.js'

// MCP mat is 36" x 36". Table is larger — 48" x 48" in the same unit space.
// 1 Three.js unit = 1 inch. Mat = 36 x 36, table = 48 x 48.
const MAT_SIZE = 36
const TABLE_SIZE = 48
const TABLE_THICKNESS = 0.5
const TABLE_COLLIDER_HALF_H = 5
const DROP_HEIGHT = 15
// Range tools hang this far above the table and measure by the outline cast below them
const TOOL_HOVER_HEIGHT = 1
const MAP = MAPS['vibranium-heist']

export default function Scene({ activeRange, activeMove }) {
  const matTexture = useTexture(MAP.mat)
  // One character and one tool can be selected at the same time
  const [selectedCharId, setSelectedCharId] = useState(null)
  const [selectedToolId, setSelectedToolId] = useState(null)
  const [characters] = useState([
    { id: 'angel-1', url: '/angel.glb', position: [0, DROP_HEIGHT, 0], teamColor: 'red', scale: 1 },
  ])
  // Character id → Rapier body. Tools read and move the selected character through it.
  const charBodies = useRef(new Map())

  const selectedChar = characters.find(ch => ch.id === selectedCharId)
  const toolTarget = useMemo(() => selectedChar && {
    getBody: () => charBodies.current.get(selectedChar.id),
    radius: BASE_RADIUS * selectedChar.scale,
    scale: selectedChar.scale,
  }, [selectedChar])

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
      <Environment preset="city" backgroundIntensity={0} />

      <Physics gravity={[0, -30, 0]}>
        {/* Table surface — fixed collider so models land on it */}
        <RigidBody type="fixed" colliders={false}>
          {/* Collider much thicker than the visual so fast bodies can't tunnel through; top stays at y=0 */}
          <CuboidCollider
            args={[TABLE_SIZE / 2, TABLE_COLLIDER_HALF_H, TABLE_SIZE / 2]}
            position={[0, -TABLE_COLLIDER_HALF_H, 0]}
            friction={1.5}
          />
          <mesh position={[0, -TABLE_THICKNESS / 2, 0]} receiveShadow>
            <boxGeometry args={[TABLE_SIZE, TABLE_THICKNESS, TABLE_SIZE]} />
            <meshStandardMaterial color="#2a1a0a" roughness={0.8} metalness={0.05} />
          </mesh>
        </RigidBody>

        {/* Mat */}
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[MAT_SIZE, MAT_SIZE]} />
          <meshStandardMaterial map={matTexture} roughness={1} metalness={0} />
        </mesh>

        <Terrain placements={MAP.placements} />

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
          />
        ))}

        {activeMove && (
          <MovementRuler
            key={activeMove}
            type={activeMove}
            position={[0, DROP_HEIGHT, 0]}
            selected={selectedToolId === 'move'}
            onSelect={() => toggleTool('move')}
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
          />
        )}
      </Physics>
    </>
  )
}
