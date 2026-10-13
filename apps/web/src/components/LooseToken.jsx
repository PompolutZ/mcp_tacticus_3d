import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { castDown } from '../physics.js'
import { tokenSize } from '../tokens/tokens.js'
import { TOKEN_DRAG_LIFT, TOKEN_THICKNESS } from '../tokens/solid.js'
import { tokenStack } from '../tokens/stack.js'
import { TOKEN_RADIUS } from './CrisisToken.jsx'
import DragFootprint from './DragFootprint.jsx'
import TokenFace from './TokenFace.jsx'
import useLiveFollow from './useLiveFollow.js'

// A thin cylinder as wide as the token finds the ground under it, the same as CrisisToken.jsx.
const HALF_H = 0.02
// Gap between the ground and the token, so the token never z-fights with the surface
const GAP = 0.02
const NO_ROTATION = { x: 0, y: 0, z: 0, w: 1 }

// A character token that lies on the table: dropped there from a Give source, a pile or the Library
// (see crisis/useCrisisTokens.js, handleTokenDrop). It has no physics body. Each frame it sits on the table or on
// the terrain under it, the same as a crisis token, so a mat turn or a map change keeps it on top.
// A token lies on the highest crisis token or earlier loose token under its center, else on the table or
// the terrain (tokens/stack.js). token: { id, key, x, z, count?, pile? }, see App.jsx, looseTokens. index: its place in
// that list; the tokens after it lie on top. onDragStart(nativeEvent): a left
// pointerdown, App starts the same drag as from a source. onHover(over): for the Delete key.
// count: the number shown on top when 2 or more (token.count, a collected token's pile); Scene lowers it by 1 while a token is taken off by a drag. remote: the other player drags the token. getLivePose(key): their latest numbers. The token follows them,
// hangs above the table like a dragged token and shows its footprint (this browser has no TokenDragPreview).
export default function LooseToken({
  token,
  index,
  onDragStart,
  onHover,
  count = token.count ?? 1,
  remote = false,
  getLivePose = null,
}) {
  const { world, rapier } = useRapier()
  const shape = useMemo(
    () => new rapier.Cylinder(HALF_H, tokenSize(token.key) / 2),
    [rapier, token.key],
  )
  const groupRef = useRef()
  // The pose that is drawn, and the place in the document
  const poseRef = useRef({ x: token.x, z: token.z })
  const placeRef = useRef({ x: token.x, z: token.z })

  const follow = useLiveFollow({
    pieceKey: `loose:${token.id}`,
    remote,
    getLivePose,
    poseRef,
    placeRef,
  })

  useEffect(() => {
    placeRef.current = { x: token.x, z: token.z }
    poseRef.current = { ...placeRef.current }
  }, [token.x, token.z])

  useEffect(() => () => tokenStack.removeLoose(token.id), [token.id])

  useFrame(() => {
    const { x, z } = poseRef.current
    // ONLY_FIXED + EXCLUDE_SENSORS inside castDown, so models and tools are ignored
    const ground = castDown(world, rapier, shape, NO_ROTATION, x, z, HALF_H) ?? 0
    const lifted = follow.current.moved
    // Never below the table or terrain, also when the token below is low
    const rest = lifted ? ground : Math.max(ground, tokenStack.topAt(x, z, index) ?? ground)
    const y = rest + GAP + (lifted ? TOKEN_DRAG_LIFT : 0)
    groupRef.current?.position.set(x, y, z)
    // A lifted token (the other player drags it) holds nothing, so the token on top goes down
    if (lifted) tokenStack.removeLoose(token.id)
    else tokenStack.putLoose(token.id, x, z, tokenSize(token.key) / 2, y + TOKEN_THICKNESS, index)
  })

  const footprintShape = () =>
    follow.current.moved ? { ...poseRef.current, radius: TOKEN_RADIUS } : null

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
          size={tokenSize(token.key)}
          count={count}
          upright
          cursor="grab"
          onPointerDown={handlePointerDown}
          onHover={onHover}
        />
      </Suspense>
      {remote && <DragFootprint getShape={footprintShape} />}
    </group>
  )
}
