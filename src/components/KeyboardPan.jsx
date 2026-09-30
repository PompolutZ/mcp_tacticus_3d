import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'

// Pan speed as a part of the camera distance per second, so it feels the same at every zoom
const PAN_RATE = 0.8

const up = new Vector3()
const right = new Vector3()
const move = new Vector3()

// Pans the camera over the table plane while a pan key is held, as in TTS. App handles the keys
// (see PAN_KEYS in keyboard.js). held: ref to a Map of the held keys, key code → screen direction
// [right, up]. The camera and the orbit target move together, so the view angle and the zoom stay the same.
export function KeyboardPan({ held }) {
  const camera = useThree(state => state.camera)
  const controls = useThree(state => state.controls)

  useFrame((_, dt) => {
    if (!controls || held.current.size === 0) return
    let dx = 0
    let dy = 0
    for (const [x, y] of held.current.values()) {
      dx += x
      dy += y
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
