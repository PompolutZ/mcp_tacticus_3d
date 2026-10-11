import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { tablePoint } from '../drag/tablePoint.js'
import { followPart, numbersToPose } from '../net/livePose.js'
import { castDown } from '../physics.js'
import { tokenSize } from '../tokens/tokens.js'
import { tokenStack } from '../tokens/stack.js'
import { TOKEN_RADIUS } from './CrisisToken.jsx'
import DragFootprint from './DragFootprint.jsx'
import { TOKEN_DRAG_LIFT } from '../tokens/solid.js'

// Gap between the ground and the token, the same as LooseToken.jsx
const GAP = 0.02

// The dragged token, real size, TOKEN_DRAG_LIFT above the table or terrain point under the pointer
// (see App.jsx, the token drag). children: the token, with its bottom at y = 0 and no pointer events: a character
// token (TokenFace) or a crisis supply token (SupplyPile.jsx, SupplyToken). The pointer tracking is
// outside the Suspense, so it works while the token image still loads. pointRef: App reads the last
// point, { x, y, z } or null, on release.
// null means the pointer is not over the table (for example over the space around it), and the
// preview is hidden then. Only fixed bodies count, so models and dice do not catch the token.
// start: { clientX, clientY } of the pointer when the preview mounts, so the token shows (and a
// release drops it) before the next pointermove.
// stacks: the token lands on top of the tokens under it (a character token, tokens/stack.js), so it
// shows that height. A crisis supply token and a pile do not stack.
export default function TokenDragPreview({ pointRef, start, stacks = false, children }) {
  const { camera, gl } = useThree()
  const { world, rapier } = useRapier()
  const groupRef = useRef()

  useEffect(() => {
    const scene = { camera, canvas: gl.domElement, world, rapier }

    function handleMove(e) {
      const point = tablePoint(scene, e.clientX, e.clientY, { offTable: 'null' })
      pointRef.current = point
      const group = groupRef.current
      if (!group) return
      group.visible = Boolean(point)
      if (point) {
        // A dropped token goes to the end of the list, so it lies on every loose token
        const top = stacks ? tokenStack.topAt(point.x, point.z) : null
        const rest = Math.max(point.y, top ?? point.y)
        group.position.set(point.x, rest + GAP + TOKEN_DRAG_LIFT, point.z)
      }
    }

    handleMove(start)
    window.addEventListener('pointermove', handleMove)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      pointRef.current = null
    }
    // start is read only on mount: the pointermove listener follows the pointer after that
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, world, rapier, pointRef, stacks])

  // The footprint is the token radius under the point. It hides when the point is null.
  const footprintShape = () => {
    const p = pointRef.current
    return p ? { x: p.x, z: p.z, radius: TOKEN_RADIUS } : null
  }

  // Hidden until handleMove gives it a point
  return (
    <>
      <group ref={groupRef} visible={false}>
        <Suspense fallback={null}>{children}</Suspense>
      </group>
      <DragFootprint getShape={footprintShape} />
    </>
  )
}

// A thin cylinder as wide as the token finds the ground under it, the same as LooseToken.jsx
const HALF_H = 0.02
const NO_ROTATION = { x: 0, y: 0, z: 0, w: 1 }

// The preview of a new piece that the other player drags (plan 09, decision 22): the same look, height and
// footprint as TokenDragPreview, at the live pose of spawnKey. It is hidden until the first pose. The
// pose is followed the same way as other live pieces (decision 14). The yaw is not used: the own preview has none.
// getLivePose(key): the latest numbers of a piece key, or null (Scene.jsx). tokenKey: the token, for the
// width of the ground check (the default width for a crisis supply token, as before). stacks: as for
// TokenDragPreview (a loose token). children: the token, as for
// TokenDragPreview.
export function OtherSpawnPreview({ spawnKey, tokenKey, getLivePose, stacks = false, children }) {
  const { world, rapier } = useRapier()
  const shape = useMemo(
    () => new rapier.Cylinder(HALF_H, tokenSize(tokenKey) / 2),
    [rapier, tokenKey],
  )
  const groupRef = useRef()
  // The pose that is drawn: { x, z }, or null before the first live pose
  const poseRef = useRef(null)

  useFrame((_, dt) => {
    const numbers = getLivePose(spawnKey)
    const target = numbers && numbersToPose(spawnKey, numbers)
    const group = groupRef.current
    if (!target) {
      poseRef.current = null
      if (group) group.visible = false
      return
    }
    const part = followPart(dt)
    const pose = poseRef.current ?? target
    poseRef.current = {
      x: pose.x + (target.x - pose.x) * part,
      z: pose.z + (target.z - pose.z) * part,
    }
    const { x, z } = poseRef.current
    const ground = castDown(world, rapier, shape, NO_ROTATION, x, z, HALF_H) ?? 0
    if (!group) return
    group.visible = true
    const top = stacks ? tokenStack.topAt(x, z) : null
    group.position.set(x, Math.max(ground, top ?? ground) + GAP + TOKEN_DRAG_LIFT, z)
  })

  const footprintShape = () => {
    const p = poseRef.current
    return p ? { x: p.x, z: p.z, radius: TOKEN_RADIUS } : null
  }

  return (
    <>
      <group ref={groupRef} visible={false}>
        <Suspense fallback={null}>{children}</Suspense>
      </group>
      <DragFootprint getShape={footprintShape} />
    </>
  )
}
