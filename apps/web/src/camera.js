// Camera moves shared by the keyboard (KeyboardCamera.jsx) and the wheel (WheelCamera.jsx).
// Plain module, no React.
import { MOUSE, Vector3 } from 'three'

// Frame priority of the camera moves of the keyboard and the wheel. Frame callbacks run from the lowest
// priority, and most of them have priority 0. For example, each drei <Html> (tray keys, tool buttons)
// reads the camera in its frame callback. If the camera moved after that, the <Html> would be one frame
// behind the 3D view while the camera moves. OrbitControls updates at -1 too (drei).
export const CAMERA_FRAME_PRIORITY = -1

const up = new Vector3()
const right = new Vector3()
const move = new Vector3()

// Moves the camera and the orbit target together over the table plane, so the view angle and the
// zoom stay the same. dx, dy: inches along screen right and screen up, flattened onto the table.
// Screen up works also in a top-down view, where the view direction has no part on the table plane.
export function panOnTable(camera, target, dx, dy) {
  up.set(0, 1, 0).applyQuaternion(camera.quaternion).setY(0).normalize()
  right.set(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize()
  move.copy(right).multiplyScalar(dx).addScaledVector(up, dy)
  camera.position.add(move)
  target.add(move)
}

// Smooth start and end: 0 → 0, 1 → 1, slowest at both ends
export const easeInOut = (t) => t * t * (3 - 2 * t)

// Moves the orbit target to `point` ({ x, y, z }) in `ms`, smooth. The camera moves by the same shift, so the
// view angle and the distance stay (the drop notice, "Show"). controls: OrbitControls. Returns a function that
// stops the move. raf and now are for a test.
export function panToPoint(
  controls,
  point,
  {
    ms = 600,
    raf = requestAnimationFrame,
    caf = cancelAnimationFrame,
    now = () => performance.now(),
  } = {},
) {
  const { target } = controls
  const shift = new Vector3(point.x - target.x, point.y - target.y, point.z - target.z)
  const applied = new Vector3()
  const step = new Vector3()
  const start = now()
  let frame = 0
  const tick = () => {
    const t = Math.min(1, (now() - start) / ms)
    step.copy(shift).multiplyScalar(easeInOut(t)).sub(applied)
    applied.add(step)
    controls.object.position.add(step)
    target.add(step)
    controls.update()
    frame = t < 1 ? raf(tick) : 0
  }
  frame = raf(tick)
  return () => {
    if (frame) caf(frame)
    frame = 0
  }
}

// Start view, the seat of the host player. The host sits at +z (see
// characters/trays.js). The camera stands behind the host table edge and looks down at 45° at a
// point 16.8" from the mat center toward host, 46" away. Then a 16:10 view shows the whole mat, the
// tactic trays and the character trays of both players, and the own tool rack in front of the dice tray (z up
// to 27.9", see tabletools/layout.js). The bottom edge of the view meets the table at z = 37.5". The top
// edge is past the guest trays (z = -40, the table ends at -38). Space returns to this view (see
// resetView).
const CAMERA_TARGET = [0, 0, 16.8]
const CAMERA_POSITION = [0, 32.5, 49.3]
// The Red view: the Blue view turned 180° around the mat center (plan 08, decision 17). Only for the Red seat
// of a multiplayer room. A single player room and the Sandbox keep the Blue view, because one player plays both
// sides there.
const CAMERA_TARGET_GUEST = [0, 0, -16.8]
const CAMERA_POSITION_GUEST = [0, 32.5, -49.3]
// The two views are module constants, so the props of OrbitControls and Canvas keep their reference from
// render to render (R3F applies a prop again when its reference changes).
const BLUE_VIEW = { position: CAMERA_POSITION, target: CAMERA_TARGET }
const RED_VIEW = { position: CAMERA_POSITION_GUEST, target: CAMERA_TARGET_GUEST }

// The start view of a seat: { position, target }. Always one of two shared objects.
export function startView(isGuest) {
  return isGuest ? RED_VIEW : BLUE_VIEW
}

// Camera mouse buttons as in TTS: right drag turns, middle drag pans. Left drag also turns, because
// the app has no box select (the TTS left drag) and a trackpad has no easy right drag. Shift, Ctrl
// or Cmd + a turn drag pans (OrbitControls). A mouse wheel zooms. On a trackpad, a two-finger swipe
// pans and a pinch zooms (WheelCamera.jsx).
export const CAMERA_MOUSE_BUTTONS = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE }

// Moves the camera back to `view` ({ position, target }, see startView) at once. controls: OrbitControls, or
// null. wheelCamera: the handle of WheelCamera ({ stop }), or null.
export function resetView(controls, wheelCamera, view) {
  if (!controls) return
  // A zoom or pan of the wheel that is not done yet would move the camera away from the start view
  wheelCamera?.stop()
  controls.object.position.set(...view.position)
  controls.target.set(...view.target)
  controls.update()
}
