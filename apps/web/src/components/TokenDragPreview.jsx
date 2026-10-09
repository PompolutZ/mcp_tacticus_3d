import { Suspense, useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { tablePoint } from '../drag/tablePoint.js'
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
export default function TokenDragPreview({ pointRef, start, children }) {
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
      if (point) group.position.set(point.x, point.y + GAP + TOKEN_DRAG_LIFT, point.z)
    }

    handleMove(start)
    window.addEventListener('pointermove', handleMove)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      pointRef.current = null
    }
    // start is read only on mount: the pointermove listener follows the pointer after that
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, world, rapier, pointRef])

  // Hidden until handleMove gives it a point
  return (
    <group ref={groupRef} visible={false}>
      <Suspense fallback={null}>{children}</Suspense>
    </group>
  )
}
