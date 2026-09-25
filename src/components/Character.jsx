import { useTexture } from '@react-three/drei'
import { DoubleSide } from 'three'

// MCP base sizes in inches (1 unit = 1 inch)
const BASE = {
  small:  { radius: 0.63, thickness: 0.08 },
  medium: { radius: 0.79, thickness: 0.08 },
  large:  { radius: 0.98, thickness: 0.08 },
}

// Standee card dimensions in inches — physical MCP standee insert
const STANDEE_WIDTH  = 1.0
const STANDEE_HEIGHT = 1.56  // 912×1423 ≈ 0.641 aspect → 1/0.641 * 1.0

const MAT_Y = 0.01  // keep standee just above the mat surface

export default function Character({ position = [0, 0, 0], baseSize = 'small', frontUrl, backUrl }) {
  const [front, back] = useTexture([frontUrl, backUrl])
  const { radius, thickness } = BASE[baseSize]
  const baseY = MAT_Y + thickness / 2
  const standeeY = MAT_Y + STANDEE_HEIGHT / 2

  return (
    <group position={[position[0], 0, position[2]]}>
      {/* Circular base */}
      <mesh position={[0, baseY, 0]}>
        <cylinderGeometry args={[radius, radius, thickness, 32]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.6} metalness={0.3} />
      </mesh>

      {/* Standee — front face */}
      <mesh position={[0, standeeY, 0]}>
        <planeGeometry args={[STANDEE_WIDTH, STANDEE_HEIGHT]} />
        <meshStandardMaterial map={front} transparent side={DoubleSide} roughness={1} />
      </mesh>

      {/* Standee — back face (offset by 1mm to avoid z-fighting) */}
      <mesh position={[0, standeeY, -0.01]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[STANDEE_WIDTH, STANDEE_HEIGHT]} />
        <meshStandardMaterial map={back} transparent side={DoubleSide} roughness={1} />
      </mesh>
    </group>
  )
}
