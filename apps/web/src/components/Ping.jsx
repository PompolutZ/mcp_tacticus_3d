import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { playSound } from '../sound.js'
import { COLOR_HEX, useSideColor } from '../sideColors.js'

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
const LIFT = 0.04

const noRaycast = () => {}

// A ping (docs/features/ping.md): a down arrow that bounces above a point and a ring on the surface, in the
// color of the side that pinged. It plays the ping sound when it mounts, shows for LIFE seconds, then fades and
// goes. Key it by the id of the ping.
// ping: { id, at: [x, y, z], t } (net/presence.js). t is the time of the ping, in ms. A ping older than LIFE
// shows nothing and makes no sound (a table that opens late). side: the side that pinged.
export default function Ping({ ping, side }) {
  const color = useSideColor(side)
  const [done, setDone] = useState(() => Date.now() - ping.t >= LIFE * 1000)
  const arrowRef = useRef()
  const arrowMat = useRef()
  const ringMat = useRef()
  const [x, y, z] = ping.at

  useEffect(() => {
    if (!done) playSound('ping')
    // Only at the start of the ping
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(() => {
    if (done) return
    const age = (Date.now() - ping.t) / 1000
    if (age >= LIFE) {
      setDone(true)
      return
    }
    const opacity = Math.min(1, (LIFE - age) / FADE) * 0.9
    arrowMat.current.opacity = opacity
    ringMat.current.opacity = opacity
    const bounce = Math.abs(Math.sin(age * BOUNCE_SPEED)) * BOUNCE
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
      <mesh position-y={y + LIFT} rotation-x={-Math.PI / 2} raycast={noRaycast} renderOrder={10}>
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
