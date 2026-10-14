// Shared by Throw / Push (throwPath.js) and the Line of Sight length (losLength.js): the terrain under
// a base, and the distance to the mat edge.

import { MAT_SIZE } from '../table.js'

const NO_ROTATION = { x: 0, y: 0, z: 0, w: 1 }
// The test shape is the base, reaching STAND_DEPTH below it, so the piece that the base stands on counts.
const STAND_DEPTH = 0.05
// Callers that must not count a wall that the base only touches use a base this much narrower (throwPath.js,
// the Line of Sight tool). So a wall that the base only touches is not under it.
export const TOUCH_MARGIN = 0.02

// Handles of the fixed colliders that a base standing at start (table XZ) overlaps: the terrain it
// stands on, or touches inside its radius. ground: height of the base bottom there (baseGroundY).
// Callers that must not count a wall that the base only touches pass a radius a little smaller.
export function standingColliders(world, rapier, start, ground, radius, halfH) {
  const found = new Set()
  const stand = new rapier.Cylinder(halfH + STAND_DEPTH / 2, radius)
  const standPos = { x: start.x, y: ground + halfH - STAND_DEPTH / 2, z: start.z }
  const filter = rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS
  world.intersectionsWithShape(
    standPos,
    NO_ROTATION,
    stand,
    (collider) => {
      found.add(collider.handle)
      return true
    },
    filter,
  )
  return found
}

// A base never leaves the mat (rules p13). Distance along dir until the base edge (radius) reaches the
// mat edge; radius 0 for a line. The mat turns only by 90° around its center, so its edges stay at
// ±MAT_SIZE / 2.
export function matEdgeDistance(start, dir, radius) {
  const limit = MAT_SIZE / 2 - radius
  let d = Infinity
  for (const axis of ['x', 'z']) {
    if (dir[axis] === 0) continue
    d = Math.min(d, ((dir[axis] > 0 ? limit : -limit) - start[axis]) / dir[axis])
  }
  return Math.max(0, d)
}
