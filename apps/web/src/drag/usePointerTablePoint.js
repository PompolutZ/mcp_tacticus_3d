import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useLatest } from '../components/useLatest.js'
import { tablePoint } from './tablePoint.js'

// Follows the pointer for a drag ghost or preview. On every window pointermove (and once at mount, from
// start: { clientX, clientY }) it finds the table or terrain point under the pointer, stores it in
// pointRef (null off the table; App reads it on release) and calls onPoint(point). onPoint places the
// ghost and hides it for a null point. It is the newest onPoint that runs, so it needs no deps. Inside Physics, because tablePoint needs the world.
export function usePointerTablePoint(pointRef, start, onPoint) {
  const { camera, gl } = useThree()
  const { world, rapier } = useRapier()
  const latest = useLatest({ start, onPoint })

  useEffect(() => {
    const scene = { camera, canvas: gl.domElement, world, rapier }

    function handleMove(e) {
      const point = tablePoint(scene, e.clientX, e.clientY, { offTable: 'null' })
      pointRef.current = point
      latest.current.onPoint(point)
    }

    handleMove(latest.current.start)
    window.addEventListener('pointermove', handleMove)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      pointRef.current = null
    }
  }, [camera, gl, world, rapier, pointRef, latest])
}
