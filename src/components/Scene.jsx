import { useState } from 'react'
import { useTexture, Stars, Environment } from '@react-three/drei'
import { Physics, RigidBody } from '@react-three/rapier'
import { MovementRuler, RangeRuler } from './RulerTool.jsx'
import CharacterModel from './CharacterModel.jsx'

// MCP mat is 36" x 36". Table is larger — 48" x 48" in the same unit space.
// 1 Three.js unit = 1 inch. Mat = 36 x 36, table = 48 x 48.
const MAT_SIZE = 36
const TABLE_SIZE = 48
const TABLE_THICKNESS = 0.5
const DROP_HEIGHT = 15

export default function Scene({ activeRange, activeMove }) {
  const matTexture = useTexture('/wakanda-mat.png')
  const [selectedId, setSelectedId] = useState(null)
  const [characters, setCharacters] = useState([
    { id: 'angel-1', url: '/angel.glb', position: [0, DROP_HEIGHT, 0], teamColor: 'red' },
  ])

  function handlePlace(pos) {
    const id = `angel-${Date.now()}`
    setCharacters(prev => [...prev, {
      id,
      url: '/angel.glb',
      position: [pos.x, DROP_HEIGHT, pos.z],
      teamColor: 'blue',
    }])
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
        <RigidBody type="fixed">
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

        {characters.map(ch => (
          <CharacterModel
            key={ch.id}
            url={ch.url}
            position={ch.position}
            scale={1}
            teamColor={ch.teamColor}
            selected={selectedId === ch.id}
            onSelect={() => setSelectedId(prev => prev === ch.id ? null : ch.id)}
          />
        ))}

        {activeMove && (
          <MovementRuler
            key={activeMove}
            type={activeMove}
            position={[0, DROP_HEIGHT, 0]}
            selected={selectedId === 'move'}
            onSelect={() => setSelectedId(prev => prev === 'move' ? null : 'move')}
          />
        )}
        {activeRange && (
          <RangeRuler
            key={activeRange}
            number={activeRange}
            position={[0, DROP_HEIGHT, 6]}
            selected={selectedId === 'range'}
            onSelect={() => setSelectedId(prev => prev === 'range' ? null : 'range')}
            onPlace={handlePlace}
          />
        )}
      </Physics>
    </>
  )
}
