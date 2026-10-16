import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { castDown } from '../physics.js'
import { tokenSize } from './tokens.js'
import { TOKEN_DRAG_LIFT, TOKEN_THICKNESS } from './solid.js'
import { tokenStack } from './stack.js'
import { TOKEN_RADIUS } from '../crisis/CrisisToken.jsx'
import { tokenFootprint } from '../drag/tokenDrop.js'
import DragFootprint from '../scene/DragFootprint.jsx'
import TokenFace from './TokenFace.jsx'
import useLiveFollow from '../scene/useLiveFollow.jsx'
import { SURFACE_GAP } from '../pieces/heights.js'
import { NO_ROTATION } from '../characters/base.js'
import { useTableStore } from '../table/TableStoreContext.jsx'
import { useOtherSelected, useRangeMark, useRemote } from '../table/useOtherPlayer.jsx'
import { isSelected } from '../selection.js'

// A thin cylinder as wide as the token finds the ground under it, the same as CrisisToken.jsx.
const HALF_H = 0.02

// A character token that lies on the table: dropped there from a Give source, a pile or the Library
// (see crisis/useCrisisTokens.js, handleTokenDrop). It has no physics body. Each frame it sits on the table or on
// the terrain under it, the same as a crisis token, so a mat turn or a map change keeps it on top.
// A token lies on the highest crisis token or earlier loose token under its center, else on the table or
// the terrain (tokens/stack.js). token: { id, key, x, z, count?, pile? }, see App.jsx, looseTokens. index: its place in
// that list; the tokens after it lie on top. onDragStart(nativeEvent): a left
// pointerdown, App starts the same drag as from a source. onHover(over): for the Delete key and the tool keys.
// The outline (selected, range mark, the other player's selection) comes from the store, as for a crisis token. objects, centers: the Scene's Maps by token id for the
// tools (docs/features/range-movement-tools.md).
// count: the number shown on top when 2 or more (token.count, a collected token's pile); Scene lowers it by 1 while a token is taken off by a drag. While the other player drags the token (useRemote), it follows their latest numbers,
// hangs above the table like a dragged token and shows its footprint (this browser has no TokenDragPreview).
export default function LooseToken({
  token,
  index,
  onDragStart,
  onHover,
  count = token.count ?? 1,
  objects,
  centers,
}) {
  const selected = useTableStore((s) => isSelected(s.selection, 'loose', token.id))
  const rangeMark = useRangeMark('loose', token.id)
  const otherSelected = useOtherSelected('loose', token.id)
  const remote = useRemote(`loose:${token.id}`)
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
    poseRef,
    placeRef,
  })

  useEffect(() => {
    placeRef.current = { x: token.x, z: token.z }
    poseRef.current = { ...placeRef.current }
  }, [token.x, token.z])

  // Registers the object (the tools' pointer raycast) and a live center getter for the tools, in the
  // Scene's maps, by token id (see Scene.jsx, toolModels)
  useEffect(() => {
    centers.set(token.id, () => ({
      x: poseRef.current.x,
      y: groupRef.current?.position.y ?? 0,
      z: poseRef.current.z,
    }))
    return () => centers.delete(token.id)
  }, [centers, token.id])

  function setGroupRef(obj) {
    groupRef.current = obj
    if (obj) objects.set(token.id, obj)
    else objects.delete(token.id)
  }

  useEffect(() => () => tokenStack.removeLoose(token.id), [token.id])

  useFrame(() => {
    const { x, z } = poseRef.current
    // ONLY_FIXED + EXCLUDE_SENSORS inside castDown, so models and tools are ignored
    const ground = castDown(world, rapier, shape, NO_ROTATION, x, z, HALF_H) ?? 0
    const lifted = follow.current.moved
    // Never below the table or terrain, also when the token below is low
    const rest = lifted ? ground : Math.max(ground, tokenStack.topAt(x, z, index) ?? ground)
    const y = rest + SURFACE_GAP + (lifted ? TOKEN_DRAG_LIFT : 0)
    groupRef.current?.position.set(x, y, z)
    // A lifted token (the other player drags it) holds nothing, so the token on top goes down
    if (lifted) tokenStack.removeLoose(token.id)
    else tokenStack.putLoose(token.id, x, z, tokenSize(token.key) / 2, y + TOKEN_THICKNESS, index)
  })

  const footprintShape = () => tokenFootprint(follow, poseRef, TOKEN_RADIUS)

  function handlePointerDown(e) {
    // Only the left button moves a piece. A right or middle drag goes to OrbitControls (the camera).
    if (e.button !== 0) return
    e.stopPropagation()
    onDragStart(e.nativeEvent)
  }

  return (
    <group ref={setGroupRef} position={[token.x, SURFACE_GAP, token.z]}>
      <Suspense fallback={null}>
        <TokenFace
          tokenKey={token.key}
          size={tokenSize(token.key)}
          count={count}
          upright
          cursor="grab"
          onPointerDown={handlePointerDown}
          onHover={onHover}
          selected={selected}
          rangeMark={rangeMark}
          otherSelected={otherSelected}
        />
      </Suspense>
      {remote && <DragFootprint getShape={footprintShape} />}
    </group>
  )
}
