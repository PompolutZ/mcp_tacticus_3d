import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { tablePoint } from './tablePoint.js'
import { onDragRefresh } from './pointerDrag.js'

// Follows the pointer for a drag ghost or preview. On every window pointermove (and once at mount, from
// start: { clientX, clientY }, and again at the same pointer place when the camera moved: refreshActiveDrag) it finds the table or terrain point under the pointer, stores it in
// pointRef (null off the table; App reads it on release) and calls onPoint(point). onPoint places the
// ghost and hides it for a null point. deps: what onPoint reads from the render (the effect runs again
// when they change). Inside Physics, because tablePoint needs the world.
export function usePointerTablePoint(pointRef, start, onPoint, deps) {
  const { camera, gl } = useThree()
  const { world, rapier } = useRapier()

  useEffect(() => {
    const scene = { camera, canvas: gl.domElement, world, rapier }

    let last = start

    function handleMove(e) {
      last = e
      const point = tablePoint(scene, e.clientX, e.clientY, { offTable: 'null' })
      pointRef.current = point
      onPoint(point)
    }

    handleMove(start)
    window.addEventListener('pointermove', handleMove)
    const stopRefresh = onDragRefresh(() => handleMove(last))
    return () => {
      stopRefresh()
      window.removeEventListener('pointermove', handleMove)
      pointRef.current = null
    }
    // start is read only on mount: the pointermove listener follows the pointer after that.
    // onPoint is the caller's closure over deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, world, rapier, pointRef, ...deps])
}
