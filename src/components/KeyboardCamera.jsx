import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Spherical, Vector3 } from 'three'
import { CAMERA_FRAME_PRIORITY, panOnTable } from '../camera.js'

// Pan speed as a part of the camera distance per second, so it feels the same at every zoom
const PAN_RATE = 0.8
// Turn speed in radians per second (90°). Picked by look, not measured in TTS.
const TURN_RATE = Math.PI / 2

const offset = new Vector3()
const spherical = new Spherical()

// Sums the screen directions [right, up] of the held keys
function heldDirection(held) {
  let dx = 0
  let dy = 0
  for (const [x, y] of held.values()) {
    dx += x
    dy += y
  }
  return [dx, dy]
}

// Moves the camera while a pan key or a turn key is held, as in TTS. App handles the keys (see
// PAN_KEYS and TURN_KEYS in keyboard.js). pan, turn: refs to a Map of the held keys, key code →
// screen direction [right, up].
export function KeyboardCamera({ pan, turn }) {
  const camera = useThree(state => state.camera)
  const controls = useThree(state => state.controls)

  useFrame((_, dt) => {
    if (!controls) return
    if (pan.current.size > 0) panCamera(heldDirection(pan.current), dt)
    if (turn.current.size > 0) turnCamera(heldDirection(turn.current), dt)
  }, CAMERA_FRAME_PRIORITY)

  function panCamera([dx, dy], dt) {
    const length = Math.hypot(dx, dy)
    if (length === 0) return
    const step = camera.position.distanceTo(controls.target) * PAN_RATE * dt / length
    panOnTable(camera, controls.target, dx * step, dy * step)
  }

  // Turns the camera around the orbit target, the same way a mouse drag does in OrbitControls.
  // Right turns the view to the right, so the camera moves to its left. Up tilts the view up, so
  // the camera moves down toward the table. The tilt has the same limits as OrbitControls.
  function turnCamera([dx, dy], dt) {
    offset.copy(camera.position).sub(controls.target)
    spherical.setFromVector3(offset)
    spherical.theta -= dx * TURN_RATE * dt
    spherical.phi = MathUtils.clamp(spherical.phi + dy * TURN_RATE * dt, controls.minPolarAngle, controls.maxPolarAngle)
    // A view straight down has no up direction for lookAt
    spherical.makeSafe()
    offset.setFromSpherical(spherical)
    camera.position.copy(controls.target).add(offset)
    // OrbitControls turns the camera to the target only in its next update, one frame late
    camera.lookAt(controls.target)
  }

  return null
}
