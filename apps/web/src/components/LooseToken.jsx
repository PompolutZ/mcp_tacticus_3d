import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { castDown } from '../physics.js'
import { TOKEN_SIZE } from '../tokens/files.js'
import TokenFace from './TokenFace.jsx'

// A thin cylinder as wide as the token finds the ground under it, the same as CrisisToken.jsx.
const HALF_H = 0.02
// Gap between the ground and the token, so the token never z-fights with the surface
const GAP = 0.02
const NO_ROTATION = { x: 0, y: 0, z: 0, w: 1 }

// A character token that lies on the table: dropped there from a Give source, a pile or the Library
// (see App.jsx, handleTokenDrop). It has no physics body. Each frame it sits on the table or on
// the terrain under it, the same as a crisis token, so a mat turn or a map change keeps it on top.
// token: { id, key, x, z }, see App.jsx, looseTokens. onDragStart(nativeEvent): a left
// pointerdown, App starts the same drag as from a source. onHover(over): for the Delete key.
export default function LooseToken({ token, onDragStart, onHover }) {
  const { world, rapier } = useRapier()
  const shape = useMemo(() => new rapier.Cylinder(HALF_H, TOKEN_SIZE / 2), [rapier])
  const groupRef = useRef()

  useFrame(() => {
    // ONLY_FIXED + EXCLUDE_SENSORS inside castDown, so models and tools are ignored
    const ground = castDown(world, rapier, shape, NO_ROTATION, token.x, token.z, HALF_H)
    groupRef.current?.position.set(token.x, (ground ?? 0) + GAP, token.z)
  })

  function handlePointerDown(e) {
    // Only the left button moves a piece. A right or middle drag goes to OrbitControls (the camera).
    if (e.button !== 0) return
    e.stopPropagation()
    onDragStart(e.nativeEvent)
  }

  return (
    <group ref={groupRef} position={[token.x, GAP, token.z]}>
      <Suspense fallback={null}>
        <TokenFace
          tokenKey={token.key}
          cursor="grab"
          onPointerDown={handlePointerDown}
          onHover={onHover}
        />
      </Suspense>
    </group>
  )
}
