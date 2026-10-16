import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Spherical, Vector3 } from 'three'
import { isDragActive, refreshActiveDrag } from '../drag/pointerDrag.js'
import { createCameraOwner, setMouseCamera } from '../cameraOwner.js'
import { CAMERA_FRAME_PRIORITY, panOnTable, stepVelocity } from '../camera.js'

// Pan speed as a part of the camera distance per second, so it feels the same at every zoom
const PAN_RATE = 0.8
// Turn speed in radians per second (90°). Picked by look, not measured in TTS.
const TURN_RATE = Math.PI / 2

// Time for the speed to go most of the way to the target speed, in seconds. Picked by look.
// docs/features/key-shortcuts.md, "Smooth camera keys".
const KEY_SMOOTH_TIME = 0.15

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

// Direction of the held pan keys with length 1, so a diagonal is not faster
function unitDirection(held) {
  const [dx, dy] = heldDirection(held)
  const length = Math.hypot(dx, dy)
  return length === 0 ? [0, 0] : [dx / length, dy / length]
}

function easeVelocity([vx, vy], [tx, ty], dt) {
  return [stepVelocity(vx, tx, dt, KEY_SMOOTH_TIME), stepVelocity(vy, ty, dt, KEY_SMOOTH_TIME)]
}

// Moves the camera while a pan key or a turn key is held, as in TTS. App handles the keys (see
// input/bindings.js). pan, turn: refs to a Map of the held actions, action id →
// screen direction [right, up]. While a pointer drag is in progress, it is moved again after each camera move
// (drag/pointerDrag.js, refreshActiveDrag), so the piece stays under the pointer.
// The first input wins: a mouse camera drag blocks the keys, and held keys turn the OrbitControls drag
// off (cameraOwner.js, docs/features/key-shortcuts.md, "One camera input at a time").
export function KeyboardCamera({ pan, turn }) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)

  const owner = useRef(null)
  owner.current ??= createCameraOwner()
  // Current velocity [right, up] of the pan and the turn, in held-key direction units
  const panV = useRef([0, 0])
  const turnV = useRef([0, 0])
  const heldRef = useRef(false)

  // The mouse owns the camera from the start of an OrbitControls drag to its end. The window events
  // cover a drag that ends outside the canvas or the window, and a lost focus.
  useEffect(() => {
    if (!controls) return
    const o = owner.current
    const start = () => {
      if (!o.mouseStart(heldRef.current)) return
      // The mouse takes over a glide at once
      panV.current = [0, 0]
      turnV.current = [0, 0]
    }
    const end = () => o.mouseEnd()
    controls.addEventListener('start', start)
    controls.addEventListener('end', end)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    const release = () => {
      o.release()
      panV.current = [0, 0]
      turnV.current = [0, 0]
    }
    window.addEventListener('blur', release)
    return () => {
      controls.removeEventListener('start', start)
      controls.removeEventListener('end', end)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('blur', release)
      setMouseCamera(controls, true)
    }
  }, [controls])

  useFrame((_, dt) => {
    if (!controls) return
    const held = pan.current.size > 0 || turn.current.size > 0
    heldRef.current = held
    const o = owner.current
    // A held key owns the camera; a glide after the release does not block the mouse
    const gliding = panV.current.some(Boolean) || turnV.current.some(Boolean)
    const move = o.keysMove(held || gliding, isDragActive())
    // Held keys turn the mouse camera drag off. The wheel stays on (it needs controls.enabled).
    setMouseCamera(controls, !(o.owner === 'keys' && held))
    if (!move) {
      panV.current = [0, 0]
      turnV.current = [0, 0]
      return
    }
    panV.current = easeVelocity(panV.current, unitDirection(pan.current), dt)
    turnV.current = easeVelocity(turnV.current, heldDirection(turn.current), dt)
    if (panV.current.some(Boolean)) panCamera(panV.current, dt)
    if (turnV.current.some(Boolean)) turnCamera(turnV.current, dt)
    // The pointer stands still under a moving camera: a drag follows it to the new table point
    refreshActiveDrag()
  }, CAMERA_FRAME_PRIORITY)

  function panCamera([dx, dy], dt) {
    const step = camera.position.distanceTo(controls.target) * PAN_RATE * dt
    panOnTable(camera, controls.target, dx * step, dy * step)
  }

  // Turns the camera around the orbit target, the same way a mouse drag does in OrbitControls.
  // As in TTS, Left moves the camera to the left around the target and Right to the right. Up moves
  // the camera up (the view turns down toward the table), Down moves it down. The tilt has the same limits as
  // OrbitControls (docs/features/key-shortcuts.md, Arrow keys).
  function turnCamera([dx, dy], dt) {
    offset.copy(camera.position).sub(controls.target)
    spherical.setFromVector3(offset)
    spherical.theta += dx * TURN_RATE * dt
    spherical.phi = MathUtils.clamp(
      spherical.phi - dy * TURN_RATE * dt,
      controls.minPolarAngle,
      controls.maxPolarAngle,
    )
    // A view straight down has no up direction for lookAt
    spherical.makeSafe()
    offset.setFromSpherical(spherical)
    camera.position.copy(controls.target).add(offset)
    // OrbitControls turns the camera to the target only in its next update, one frame late
    camera.lookAt(controls.target)
  }

  return null
}
