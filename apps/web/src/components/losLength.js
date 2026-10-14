// Line of Sight length (docs/features/line-of-sight.md): how far the line runs from the looker's base
// center. To the mat edge, or to the first terrain whose Size is larger than the block Size. The terrain
// that the looker stands on is skipped. Terrain of the same or smaller Size does not stop it.
// Characters do not stop it, and height does not matter.

import { castAlongHit } from '../physics.js'
import { matEdgeDistance } from './terrainUnder.js'

// The cast box is this tall (inches, half height), so an overhang above the line also blocks. The box
// is centered at LOS_BOX_Y, so it reaches from below the table to far above the tallest terrain.
const LOS_HALF_H = 25
const LOS_BOX_Y = 20
// The box is this thin (half length) along the line
const LOS_HALF_LEN = 0.01

// Size of the terrain that a collider belongs to (the userData of its RigidBody, see Terrain.jsx), or
// null when the collider is not terrain (the table).
export function terrainSize(collider) {
  const size = collider.parent()?.userData?.size
  return typeof size === 'number' ? size : null
}

// start: looker base center (table XZ). yaw: direction as for tools (dir = cos yaw, -sin yaw). width: line
// width, the base diameter. blockSize: Size that terrain must exceed to stop the line. skipped: Set of
// collider handles that never stop it (standingColliders under the looker).
// cast({ start, yaw, width, maxDistance, keep }): moves a box along the line and gives
// { distance, collider } for the first collider with keep(collider) true (losCast, or a fake in tests).
// Returns { distance, blocker }: blocker is { collider, size } of the terrain that stops the line, or
// null when it runs to the mat edge. The line is the center line, so the mat edge is at radius 0.
export function losLength({ start, yaw, width, blockSize, skipped, cast }) {
  const dir = { x: Math.cos(yaw), z: -Math.sin(yaw) }
  const edge = matEdgeDistance(start, dir, 0)
  const keep = (collider) => {
    if (skipped.has(collider.handle)) return false
    const size = terrainSize(collider)
    return size !== null && size > blockSize
  }
  const hit = cast({ start, yaw, width, maxDistance: edge, keep })
  if (!hit.collider) return { distance: edge, blocker: null }
  return {
    distance: Math.max(0, hit.distance - LOS_HALF_LEN),
    blocker: { collider: hit.collider, size: terrainSize(hit.collider) },
  }
}

// The Rapier cast for losLength: a tall thin box of the line width, at the line's yaw.
export function losCast(world, rapier) {
  return ({ start, yaw, width, maxDistance, keep }) => {
    const shape = new rapier.Cuboid(LOS_HALF_LEN, LOS_HALF_H, width / 2)
    const rotation = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }
    const dir = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) }
    const pos = { x: start.x, y: LOS_BOX_Y, z: start.z }
    return castAlongHit(world, rapier, shape, rotation, pos, dir, maxDistance, keep)
  }
}
