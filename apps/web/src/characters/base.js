import { Quaternion, Vector3 } from 'three'
import { castDown } from '../physics.js'

// The base of a character model and the casts that use it. Plain module (no component, no Vite import),
// so the throw and drop code and its tests load in Node.

export const NO_ROTATION = { x: 0, y: 0, z: 0, w: 1 }
// Base disk dims from angel.glb mesh0: radius≈0.983, height≈0.118
export const BASE_RADIUS = 0.983
export const BASE_HALF_H = 0.059

// Same heading, but standing upright: keeps only the turn around the vertical axis
export function upright({ y, w }) {
  const len = Math.hypot(y, w)
  return len < 1e-6 ? NO_ROTATION : { x: 0, y: y / len, z: 0, w: w / len }
}

const UP = new Vector3(0, 1, 0)
const turnQuat = new Quaternion()
const bodyQuat = new Quaternion()

// Turns the body by angle (yaw) around the vertical line through its origin, the base center, as
// Q / E do in TTS. usePieceTurns.js calls it on every frame of a smoothed turn. The base is round, so the
// turn does not push an upright model into anything.
// While the model is dragged, the drag keeps the new heading (see upright).
export function turnBody(body, angle) {
  const r = body.rotation()
  turnQuat.setFromAxisAngle(UP, angle).multiply(bodyQuat.set(r.x, r.y, r.z, r.w))
  body.setRotation(turnQuat, true)
}

// Top of the table or terrain under the whole base at (x, z), or null when nothing is under it.
// A cast of the base shape, not a ray, so terrain under any part of the base counts.
// The body origin is the base bottom, so this is also the body Y that puts the base on the ground.
// from: height of the base bottom where the cast starts, when it is not above everything.
export function baseGroundY(world, rapier, x, z, radius = BASE_RADIUS, from = undefined) {
  return castDown(
    world,
    rapier,
    new rapier.Cylinder(BASE_HALF_H, radius),
    NO_ROTATION,
    x,
    z,
    BASE_HALF_H,
    from,
  )
}
