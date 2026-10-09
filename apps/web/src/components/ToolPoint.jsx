import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { tablePoint } from '../drag/tablePoint.js'

// Fills pointRef with { atPointer(), atCenter() }: the table or terrain point where a tool spawns free
// (App, "Tools spawn at the pointer"). It lives inside Physics, because tablePoint needs the world.
// atPointer: the point under the last pointer position, or null when the pointer is not over the canvas
// or not over the table. atCenter: the point in the middle of the canvas (the table plane when the
// middle sees no collider), or null. Both give { x, z }.
export default function ToolPoint({ pointRef }) {
  const { camera, gl, pointer } = useThree()
  const { world, rapier } = useRapier()

  useEffect(() => {
    if (!pointRef) return undefined
    const scene = { camera, canvas: gl.domElement, world, rapier }
    const flat = (point) => (point ? { x: point.x, z: point.z } : null)
    pointRef.current = {
      atPointer() {
        if (!gl.domElement.matches(':hover')) return null
        const rect = gl.domElement.getBoundingClientRect()
        const x = rect.left + ((pointer.x + 1) / 2) * rect.width
        const y = rect.top + ((1 - pointer.y) / 2) * rect.height
        return flat(tablePoint(scene, x, y, { offTable: 'null' }))
      },
      atCenter() {
        const rect = gl.domElement.getBoundingClientRect()
        const x = rect.left + rect.width / 2
        const y = rect.top + rect.height / 2
        return flat(tablePoint(scene, x, y))
      },
    }
    return () => {
      pointRef.current = null
    }
  }, [pointRef, camera, gl, pointer, world, rapier])

  return null
}
