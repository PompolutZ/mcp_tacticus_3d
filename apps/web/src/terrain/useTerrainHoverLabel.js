import { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { ndcFromClient } from '../drag/screenRay.js'
import { useLatest } from '../scene/useLatest.js'

// The terrain piece under the pointer while labels are off, or null. Called in Terrain, so the state
// renders Terrain only. terrainUnder may be a new function each render: it is read through useLatest.
// Without terrainUnder (the terrain editor) there is no hover label.
export function useTerrainHoverLabel({ showLabels, terrainUnder }) {
  const { camera, gl } = useThree()
  // Hover label: with labels off, the piece under the pointer shows its label, locked or not. One ray
  // per frame at most, only on pointer move, and the state changes only when the id changes.
  const [hoverLabelId, setHoverLabelId] = useState(null)
  const underNow = useLatest(terrainUnder)
  const hasUnder = !!terrainUnder
  useEffect(() => {
    if (showLabels || !hasUnder) return undefined
    const canvas = gl.domElement
    let frame = 0
    let last = null
    function cast() {
      frame = 0
      setHoverLabelId(underNow.current(ndcFromClient(canvas, last.clientX, last.clientY)))
    }
    function onMove(e) {
      last = e
      if (!frame) frame = requestAnimationFrame(cast)
    }
    function onLeave() {
      cancelAnimationFrame(frame)
      frame = 0
      setHoverLabelId(null)
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    return () => {
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(frame)
      setHoverLabelId(null)
    }
  }, [showLabels, hasUnder, gl, camera, underNow])
  // The effect cleanup clears the label when labels turn on, but a render in between must not show it
  return showLabels ? null : hoverLabelId
}
