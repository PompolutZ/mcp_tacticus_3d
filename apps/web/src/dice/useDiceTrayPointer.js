import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Plane, Raycaster, Vector3 } from 'three'
import { ndcFromClient } from '../drag/screenRay.js'
import { overTray } from './tray.js'

const TABLE_PLANE = new Plane(new Vector3(0, 1, 0), 0)
const raycaster = new Raycaster()
const point = new Vector3()

// Which own dice tray is under the pointer, for the number keys: the pointer, projected onto the table
// plane, is inside the outline of the tray seen from above (overTray in tray.js). So the whole tray
// counts: the keys lip, the rim, a die, a model or tool in front of it, and a camera move under a
// still pointer (checked every frame). Not an R3F hit, which stops at the Html keys and at other
// pieces. The pointer counts only over the 3D view: the canvas and the drei Html drawn in its area
// (the lip buttons). Over the HUD (buttons, panels) or outside the window it is over no tray.
// sides: the trays this browser plays. onChange(side | null): called when the answer changes.
// Inside <Canvas>.
export function useDiceTrayPointer(sides, onChange) {
  const camera = useThree((s) => s.camera)
  const canvas = useThree((s) => s.gl.domElement)
  // The element R3F listens on. drei Html appends its wrappers here (events.connected, else the
  // canvas parent), so the canvas and the lip buttons are inside it and the HUD is not.
  const area = useThree((s) => s.events.connected) ?? canvas.parentElement
  // Last pointer place, or null while the pointer is outside the 3D view
  const pointer = useRef(null)
  const current = useRef(null)
  const latest = useRef({ sides, onChange })
  useEffect(() => {
    latest.current = { sides, onChange }
  })

  useEffect(() => {
    // Only a pointer over the 3D view (canvas or its Html) counts, not the HUD on top of the page
    function handleMove(e) {
      pointer.current = area?.contains(e.target) ? { x: e.clientX, y: e.clientY } : null
    }
    // The pointer left the window
    function handleOut(e) {
      if (!e.relatedTarget) pointer.current = null
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerout', handleOut)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerout', handleOut)
      if (current.current !== null) {
        current.current = null
        latest.current.onChange(null)
      }
    }
  }, [area])

  useFrame(() => {
    let side = null
    if (pointer.current) {
      raycaster.setFromCamera(ndcFromClient(canvas, pointer.current.x, pointer.current.y), camera)
      if (raycaster.ray.intersectPlane(TABLE_PLANE, point)) {
        side = latest.current.sides.find((key) => overTray(key, point)) ?? null
      }
    }
    if (side !== current.current) {
      current.current = side
      latest.current.onChange(side)
    }
  })
}
