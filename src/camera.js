// Camera moves shared by the keyboard (KeyboardCamera.jsx) and the trackpad (TrackpadCamera.jsx).
// Plain module, no React.
import { Vector3 } from 'three'

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
