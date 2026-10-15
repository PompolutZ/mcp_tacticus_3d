import { useState } from 'react'
import { UI_COLORS } from '../uiColors.js'
import { useHoverCursor, useHoverReport } from './useHoverCursor.js'

// The orange ball that turns a piece by a drag, on a selected crisis token with an arc (CrisisToken.jsx). The cursor is an open hand over it.
// onHover(over): optional. The cleanup also runs on unmount, so a removed handle does not stay hovered.
export default function TurnHandle({ position, radius, onPointerDown, onHover }) {
  const [hovered, setHovered] = useState(false)
  useHoverCursor(hovered, 'grab')

  useHoverReport(hovered, onHover)

  return (
    <mesh
      position={position}
      onPointerDown={onPointerDown}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[radius, 16, 12]} />
      <meshStandardMaterial color={UI_COLORS.orange} roughness={0.3} metalness={0.5} />
    </mesh>
  )
}
