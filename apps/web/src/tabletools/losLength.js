// Line of Sight length (docs/features/line-of-sight.md): how far the line runs from the looker's base
// center. To the mat edge, or to the first terrain whose Size is larger than the block Size. The terrain
// that the looker stands on is skipped. Terrain of the same or smaller Size does not stop it.
// Characters do not stop it, and height does not matter.

import { castAlongHit } from '../physics.js'
import { matEdgeDistance } from '../characters/terrainUnder.js'

// The cast box is this tall (inches, half height), so an overhang above the line also blocks. The box
// is centered at LOS_BOX_Y, so it reaches from below the table to far above the tallest terrain.
const LOS_HALF_H = 25
const LOS_BOX_Y = 20
// The box is this thin (half length) along the line
const LOS_HALF_LEN = 0.01
// The sight segment test (clearSight): base edge points this far apart (inches), at least this many per
// half edge, and the width of the cast box along a segment
const SIGHT_SPACING = 0.1
const SIGHT_MIN_POINTS = 16
const SIGHT_WIDTH = 0.01

// Size of the terrain that a collider belongs to (the userData of its RigidBody, see Terrain.jsx), or
// null when the collider is not terrain (the table).
export function terrainSize(collider) {
  const size = collider.parent()?.userData?.size
  return typeof size === 'number' ? size : null
}

// The collider filter: terrain with Size > blockSize that is not in skipped (a Set of collider handles)
export const losKeep = (skipped, blockSize) => (collider) => {
  if (skipped.has(collider.handle)) return false
  const size = terrainSize(collider)
  return size !== null && size > blockSize
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
  const keep = losKeep(skipped, blockSize)
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

// Sight from any part of the base (docs/features/line-of-sight.md, "The line"). Finds a straight segment
// from a point of the looker base to a point of the target base that no blocking terrain crosses.
// from, to: base centers (table XZ). fromRadius, toRadius: base radii.
// blocked({ start, yaw, width, maxDistance }): true when blocking terrain touches a thin tall box moved
// along that segment (losSegmentBlocked, or a fake in tests).
// Points: the two centers, and points on the edge of each base, only on the half that faces the other
// base, about SIGHT_SPACING apart. Order: center to center, then pairs on parallel lines (same side of the
// line between the centers), then the rest. The first clear pair ends the test.
// Returns { a, b } (table XZ points), or null when every pair is blocked.
export function clearSight({ from, fromRadius, to, toRadius, blocked }) {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const gap = Math.hypot(dx, dz)
  if (gap === 0) return { a: { ...from }, b: { ...to } }
  const u = { x: dx / gap, z: dz / gap }
  const n = { x: -u.z, z: u.x }
  // One point count for both edges (from the larger base), so index i has the same angle on both
  const count = Math.max(
    SIGHT_MIN_POINTS,
    Math.ceil((Math.PI * Math.max(fromRadius, toRadius)) / SIGHT_SPACING),
  )
  const edge = (center, radius, sign) => {
    const points = []
    for (let i = 0; i <= count; i++) {
      const t = -Math.PI / 2 + (Math.PI * i) / count
      const along = Math.cos(t) * sign
      const side = Math.sin(t)
      points.push({
        x: center.x + radius * (u.x * along + n.x * side),
        z: center.z + radius * (u.z * along + n.z * side),
      })
    }
    return points
  }
  const as = edge(from, fromRadius, 1)
  const bs = edge(to, toRadius, -1)
  const clear = (a, b) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const yaw = Math.atan2(-(b.z - a.z), b.x - a.x)
    return !blocked({ start: a, yaw, width: SIGHT_WIDTH, maxDistance: len })
  }
  if (clear(from, to)) return { a: { ...from }, b: { ...to } }
  for (let i = 0; i < as.length; i++) if (clear(as[i], bs[i])) return { a: as[i], b: bs[i] }
  for (let i = 0; i < as.length; i++)
    for (let j = 0; j < bs.length; j++)
      if (i !== j && clear(as[i], bs[j])) return { a: as[i], b: bs[j] }
  return null
}

// The Rapier test for clearSight: losCast along a segment with the keep filter of losKeep.
export function losSegmentBlocked(world, rapier, keep) {
  const cast = losCast(world, rapier)
  return ({ start, yaw, width, maxDistance }) =>
    cast({ start, yaw, width, maxDistance, keep }).collider !== null
}

// The rest time (s) the models must stand still before the sight test runs again. A turn updates the length at once.
export const LOS_REST = 0.15

export const newLosSchedule = () => ({ key: null, time: 0, yaw: null, dirty: true, stale: true })

// What useLosLine does in one frame. st: the schedule (newLosSchedule), changed in place. key: string of
// the positions and Sizes. yaw: the line yaw. dt: frame time (s).
// Returns { run, sight, reset }. run: work out the length. sight: also run the sight test (clearSight).
// reset: the key changed, drop the old sight. dirty is cleared only when the rest work ran, so a turn
// in the frame of a key change does not lose the pending sight test.
export function losFrame(st, key, yaw, dt) {
  let reset = false
  if (st.key === null) {
    st.time = LOS_REST
    st.key = key
  } else if (key !== st.key) {
    st.key = key
    st.time = 0
    st.dirty = true
    st.stale = true
    reset = true
  } else st.time += dt
  const turned = st.yaw !== null && yaw !== st.yaw
  st.yaw = yaw
  if (turned) st.dirty = true
  const rested = st.time >= LOS_REST
  if (!turned && !(st.dirty && rested)) return { run: false, sight: false, reset }
  if (rested) st.dirty = false
  const sight = rested && st.stale
  if (sight) st.stale = false
  return { run: true, sight, reset }
}
