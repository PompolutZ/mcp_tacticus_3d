import { Suspense, useMemo, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { castDown } from '../physics.js'
import { assetUrl } from '../assets/index.js'
import { TOKEN_SIZE, characterToken } from '../tokens/files.js'
import { TOKEN_THICKNESS } from '../tokens/solid.js'
import TokenFace from './TokenFace.jsx'
import TokenSolid from './TokenSolid.jsx'

// A thin cylinder as wide as the token finds the ground under it, the same as LooseToken.jsx
const HALF_H = 0.02
// Gap between the ground and the pile, the same as LooseToken.jsx
const GAP = 0.02
const NO_ROTATION = { x: 0, y: 0, z: 0, w: 1 }
const NO_RAYCAST = () => null
// The two tokens under the top one are a little off center, so the stack looks like a pile. Picked by look.
const LOWER_OFFSETS = [
  [0.05, 0, -0.04],
  [-0.04, TOKEN_THICKNESS, 0.03],
]
const TOP_Y = TOKEN_THICKNESS * 2

// 3 tokens of tokenKey in a short stack, with its bottom at y = 0. Only the top token takes the
// pointer, the same as a single token (TokenFace.jsx): onPointerDown, onHover, and the name label.
// interactive false: no pointer events, for the pile under the pointer during a drag.
export function PileStack({ tokenKey, interactive = true, onPointerDown, onHover }) {
  const map = useTexture(assetUrl(characterToken(tokenKey)))
  return (
    <group>
      {LOWER_OFFSETS.map((position, i) => (
        <group key={i} position={position}>
          <TokenSolid map={map} size={TOKEN_SIZE} raycast={NO_RAYCAST} />
        </group>
      ))}
      <group position={[0, TOP_Y, 0]}>
        <TokenFace
          tokenKey={tokenKey}
          cursor="grab"
          interactive={interactive}
          onPointerDown={onPointerDown}
          onHover={onHover}
        />
      </group>
    </group>
  )
}

// A pile of character tokens on the table, dropped there from the Library in Pile mode. It never
// runs out, the same as a Give source of a tray. A left drag takes a new token (onTakeStart), Shift +
// left drag moves the pile (onMoveStart). It has no physics body; each frame it sits on the table or
// the terrain under it, the same as LooseToken.jsx. See docs/feature-library.md, "Pile".
// pile: { id, key, x, z }, see App.jsx, tokenPiles. onTakeStart(nativeEvent), onMoveStart(nativeEvent):
// App starts the token drag. onHover(over): for the Delete key.
export default function TokenPile({ pile, onTakeStart, onMoveStart, onHover }) {
  const { world, rapier } = useRapier()
  const shape = useMemo(() => new rapier.Cylinder(HALF_H, TOKEN_SIZE / 2), [rapier])
  const groupRef = useRef()

  useFrame(() => {
    // ONLY_FIXED + EXCLUDE_SENSORS inside castDown, so models and tools are ignored
    const ground = castDown(world, rapier, shape, NO_ROTATION, pile.x, pile.z, HALF_H)
    groupRef.current?.position.set(pile.x, (ground ?? 0) + GAP, pile.z)
  })

  function handlePointerDown(e) {
    // Only the left button takes a token. A right or middle drag goes to OrbitControls (the camera).
    if (e.button !== 0) return
    e.stopPropagation()
    if (e.nativeEvent.shiftKey) onMoveStart(e.nativeEvent)
    else onTakeStart(e.nativeEvent)
  }

  return (
    <group ref={groupRef} position={[pile.x, GAP, pile.z]}>
      <Suspense fallback={null}>
        <PileStack tokenKey={pile.key} onPointerDown={handlePointerDown} onHover={onHover} />
      </Suspense>
    </group>
  )
}
