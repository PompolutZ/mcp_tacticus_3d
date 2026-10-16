import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { followPart } from '../net/livePose.js'
import { COLOR_HEX, useSideColor } from '../sideColors.js'
import { MARKER_LIFT } from '../pieces/heights.js'
import { useTableStore } from '../table/TableStoreContext.jsx'

// The ring, in inches: about 0.5" across, thin
const OUTER = 0.25
const INNER = 0.2

const noRaycast = () => {}

// The other player's cursor (docs/features/peer-to-peer.md, "Cursor message"): a flat ring in their side color at the point under their
// pointer. Hidden before the first cursor, after null, and when the other player is gone. It lives in the
// scene, inside Physics or not. The pointer does not hit it.
// liveRef: LiveSync's ref ({ cursor() }). side: the other player's side.
export default function RemoteCursor({ liveRef, side }) {
  const ringRef = useRef()
  const ownership = useTableStore((s) => s.ownership)
  const color = useSideColor(side)
  // The shown point. A new cursor starts at its first point, then follows.
  const shown = useRef(null)

  useFrame((_, dt) => {
    const ring = ringRef.current
    if (!ring) return
    const cursor = ownership.otherPresent() ? liveRef.current?.cursor() : null
    if (!cursor) {
      shown.current = null
      ring.visible = false
      return
    }
    const [x, y, z] = cursor.point
    const now = shown.current
    if (!now) {
      shown.current = { x, y, z }
    } else {
      const part = followPart(dt)
      now.x += (x - now.x) * part
      now.y += (y - now.y) * part
      now.z += (z - now.z) * part
    }
    ring.position.set(shown.current.x, shown.current.y + MARKER_LIFT, shown.current.z)
    ring.visible = true
  })

  return (
    <mesh
      ref={ringRef}
      visible={false}
      rotation-x={-Math.PI / 2}
      raycast={noRaycast}
      renderOrder={10}
    >
      <ringGeometry args={[INNER, OUTER, 32]} />
      <meshBasicMaterial color={COLOR_HEX[color]} transparent opacity={0.9} depthWrite={false} />
    </mesh>
  )
}
