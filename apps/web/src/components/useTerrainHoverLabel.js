import { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'

// The terrain piece under the pointer while labels are off, or null.
export function useTerrainHoverLabel({ showLabels, terrainUnder }) {
  const { camera, gl } = useThree()
  // Hover label: with labels off, the piece under the pointer shows its label, locked or not. One ray
  // per frame at most, only on pointer move, and the state changes only when the id changes.
  const [hoverLabelId, setHoverLabelId] = useState(null)
  useEffect(() => {
    if (showLabels) {
      setHoverLabelId(null)
      return undefined
    }
    const canvas = gl.domElement
    let frame = 0
    let last = null
    function cast() {
      frame = 0
      const rect = canvas.getBoundingClientRect()
      const ndc = {
        x: ((last.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((last.clientY - rect.top) / rect.height) * 2 + 1,
      }
      setHoverLabelId(terrainUnder(ndc))
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
    // terrainUnder only reads refs and the camera
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLabels, gl, camera])
  return hoverLabelId
}
