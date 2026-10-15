import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useOnMount } from './useLatest.js'
import { playSound } from '../sound.js'
import { COLOR_HEX, useSideColor } from '../sideColors.js'
import { MARKER_LIFT } from '../pieces/heights.js'

// Seconds that a ping shows, and the last part of it that fades out
const LIFE = 3
const FADE = 0.5
// The arrow, in inches: a cone with its tip down. Its tip bounces between HOVER and HOVER + BOUNCE above the point.
const ARROW_HEIGHT = 1.4
const ARROW_RADIUS = 0.45
const HOVER = 0.3
const BOUNCE = 0.6
const BOUNCE_SPEED = 7
// The ring on the surface, and its lift above it, so it does not sink into the table or terrain
const RING_OUTER = 0.9
const RING_INNER = 0.75

const noRaycast = () => {}

// A ping (docs/features/ping.md): a down arrow that bounces above a point and a ring on the surface, in the
// color of the side that pinged. It plays the ping sound when it mounts, shows for LIFE seconds, then fades and
// goes. Its time starts at the mount, in this browser. Key it by the id of the ping.
// ping: { id, at: [x, y, z] } (net/presence.js). side: the side that pinged.
export default function Ping({ ping, side }) {
  const color = useSideColor(side)
  const [done, setDone] = useState(false)
  const age = useRef(0)
  const arrowRef = useRef()
  const arrowMat = useRef()
  const ringMat = useRef()
  const [x, y, z] = ping.at

  // Only at the start of the ping
  useOnMount(() => {
    playSound('ping')
  })

  useFrame((_, delta) => {
    if (done) return
    age.current += delta
    if (age.current >= LIFE) {
      setDone(true)
      return
    }
    const opacity = Math.min(1, (LIFE - age.current) / FADE) * 0.9
    arrowMat.current.opacity = opacity
    ringMat.current.opacity = opacity
    const bounce = Math.abs(Math.sin(age.current * BOUNCE_SPEED)) * BOUNCE
    arrowRef.current.position.y = y + HOVER + ARROW_HEIGHT / 2 + bounce
  })

  if (done) return null
  return (
    <group position={[x, 0, z]}>
      <mesh
        ref={arrowRef}
        position-y={y + HOVER + ARROW_HEIGHT / 2}
        rotation-x={Math.PI}
        raycast={noRaycast}
        renderOrder={10}
      >
        <coneGeometry args={[ARROW_RADIUS, ARROW_HEIGHT, 16]} />
        <meshBasicMaterial
          ref={arrowMat}
          color={COLOR_HEX[color]}
          transparent
          opacity={0.9}
          depthTest={false}
        />
      </mesh>
      <mesh
        position-y={y + MARKER_LIFT}
        rotation-x={-Math.PI / 2}
        raycast={noRaycast}
        renderOrder={10}
      >
        <ringGeometry args={[RING_INNER, RING_OUTER, 32]} />
        <meshBasicMaterial
          ref={ringMat}
          color={COLOR_HEX[color]}
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
