import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'

const KEYS = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }
// Pan speed as a part of the camera distance per second, so it feels the same at every zoom
const PAN_RATE = 0.8

const up = new Vector3()
const right = new Vector3()
const move = new Vector3()

// Arrow keys in a text field or a select move the cursor or the option, so they do not pan
function isEditing(target) {
  return Boolean(target.closest?.('input, textarea, select, [contenteditable]'))
}

// Arrow keys pan the camera over the table plane, as in TTS. Up moves toward the top of the screen.
// The camera and the orbit target move together, so the view angle and the zoom stay the same.
export function KeyboardPan() {
  const camera = useThree(state => state.camera)
  const controls = useThree(state => state.controls)
  const held = useRef(new Set())

  useEffect(() => {
    const keys = held.current
    function onDown(e) {
      if (!KEYS[e.code] || e.metaKey || e.ctrlKey || e.altKey || isEditing(e.target)) return
      e.preventDefault()
      keys.add(e.code)
    }
    function onUp(e) {
      keys.delete(e.code)
    }
    function onBlur() {
      keys.clear()
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  useFrame((_, dt) => {
    if (!controls || held.current.size === 0) return
    let dx = 0
    let dy = 0
    for (const code of held.current) {
      dx += KEYS[code][0]
      dy += KEYS[code][1]
    }
    // Screen up and right, flattened onto the table. Screen up works also in a top-down view,
    // where the view direction has no part on the table plane.
    up.set(0, 1, 0).applyQuaternion(camera.quaternion).setY(0).normalize()
    right.set(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize()
    move.copy(up).multiplyScalar(dy).addScaledVector(right, dx)
    if (move.lengthSq() === 0) return
    const distance = camera.position.distanceTo(controls.target)
    move.setLength(distance * PAN_RATE * dt)
    camera.position.add(move)
    controls.target.add(move)
  })

  return null
}
