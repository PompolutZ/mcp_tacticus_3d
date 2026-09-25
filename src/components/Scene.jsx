import { useTexture, Stars } from '@react-three/drei'
import Character from './Character.jsx'

// MCP mat is 36" x 36". Table is larger — 48" x 48" in the same unit space.
// 1 Three.js unit = 1 inch. Mat = 36 x 36, table = 48 x 48.
const MAT_SIZE = 36
const TABLE_SIZE = 48
const TABLE_THICKNESS = 0.5

export default function Scene() {
  const matTexture = useTexture('/wakanda-mat.png')

  return (
    <>
      {/* Space background */}
      <color attach="background" args={['#050510']} />
      <Stars radius={200} depth={60} count={5000} factor={4} fade speed={0.5} />

      {/* Ambient fill */}
      <ambientLight intensity={0.4} />
      {/* Overhead light to show the mat clearly */}
      <directionalLight position={[0, 30, 0]} intensity={1.2} />

      {/* Table surface — dark wood-tone flat slab */}
      <mesh position={[0, -TABLE_THICKNESS / 2, 0]} receiveShadow>
        <boxGeometry args={[TABLE_SIZE, TABLE_THICKNESS, TABLE_SIZE]} />
        <meshStandardMaterial color="#2a1a0a" roughness={0.8} metalness={0.05} />
      </mesh>

      {/* Mat — sits flush on top of the table surface */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[MAT_SIZE, MAT_SIZE]} />
        <meshStandardMaterial map={matTexture} roughness={0.9} />
      </mesh>

      <Character
        position={[-1.5, 0, 0]}
        baseSize="small"
        frontUrl="/omega-sentinel-standee-a.jpg"
        backUrl="/omega-sentinel-standee-b.jpg"
      />
      <Character
        position={[1.5, 0, 0]}
        baseSize="small"
        frontUrl="/medusa-standee-a.jpg"
        backUrl="/medusa-standee-b.jpg"
      />
    </>
  )
}
