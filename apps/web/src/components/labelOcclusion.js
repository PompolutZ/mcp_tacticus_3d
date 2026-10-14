// The pure part of label occlusion (LabelOcclusion.jsx): when to check, and the ray of one label.

export const CHECK_INTERVAL = 0.1 // seconds between checks
export const MOVE_EPSILON = 0.001 // world units: a camera or anchor move below this is no move
export const TURN_EPSILON = 0.0001 // 1 - |dot| of two quaternions: a turn below this is no turn
export const RAY_END_MARGIN = 0.1 // the ray stops this far before the anchor, so a surface under it does not hide it

// True when the point a = {x, y, z} is more than eps from b
export function pointMoved(a, b, eps = MOVE_EPSILON) {
  return Math.abs(a.x - b.x) > eps || Math.abs(a.y - b.y) > eps || Math.abs(a.z - b.z) > eps
}

// True when the quaternion a = {x, y, z, w} differs from b by more than eps
export function turned(a, b, eps = TURN_EPSILON) {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w
  return 1 - Math.abs(dot) > eps
}

// Whether a check runs now. A check needs the interval to have passed since the last one, and a reason:
// the camera moved, a label or terrain changed (dirty), or a label moved.
export function checkDue({
  now,
  last,
  cameraMoved,
  dirty,
  anchorMoved,
  interval = CHECK_INTERVAL,
}) {
  if (now - last < interval) return false
  return Boolean(cameraMoved || dirty || anchorMoved)
}

// The ray from the camera to an anchor: writes origin, unit direction and maxToi into out and returns
// true. False (out untouched) when the anchor is closer than the margin: nothing can be between.
export function rayToAnchor(camera, anchor, out, margin = RAY_END_MARGIN) {
  const dx = anchor.x - camera.x
  const dy = anchor.y - camera.y
  const dz = anchor.z - camera.z
  const distance = Math.hypot(dx, dy, dz)
  if (distance <= margin) return false
  out.origin.x = camera.x
  out.origin.y = camera.y
  out.origin.z = camera.z
  out.dir.x = dx / distance
  out.dir.y = dy / distance
  out.dir.z = dz / distance
  out.maxToi = distance - margin
  return true
}
