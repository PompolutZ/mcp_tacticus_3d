// Throw and Push (docs/features/range-movement-tools.md, "Throw / Push"): how far a base moves along a straight movement tool.
// The rules (p13–14) move a Thrown and a Pushed character the same way. The base stays centered on
// the tool, and it stops when it touches another character's base or a terrain piece. Only a Throw
// causes collision damage, and the players resolve that themselves.

import { BASE_HALF_H, NO_ROTATION, baseGroundY } from '../characters/base.js'
import { castAlong } from '../physics.js'
import { TOUCH_MARGIN, matEdgeDistance, standingColliders } from './terrainUnder.js'

// The base moves this far (inches) above the ground where it starts, so the terrain cast does not hit
// the surface that the base stands on
const CAST_LIFT = 0.05
// Terrain that the base overlaps at the start does not stop it (rules p14), see standingColliders.
// The ground at the start and the start overlap test use a base TOUCH_MARGIN narrower (terrainUnder.js).
// A base that hits something stops this far (inches) before it, so physics does not push the two apart
const STOP_GAP = 0.005

// start: base center at the start (table XZ). dir: unit XZ vector of the move. distance: the full move.
// radius: base radius. others: the bases of the other characters, [{ center, radius }].
// Returns { moved }: how far the base can move, the full distance or less when it touches a base,
// terrain or the mat edge first.
export function throwMove(world, rapier, { start, dir, distance, radius, others }) {
  const ground = baseGroundY(world, rapier, start.x, start.z, radius - TOUCH_MARGIN)
  const startBottom = ground === null ? null : ground + CAST_LIFT
  const hit = Math.min(
    startBottom === null
      ? Infinity
      : terrainHitDistance(world, rapier, start, dir, distance, radius, ground, startBottom),
    ...others.map((other) => baseHitDistance(start, dir, radius, other)),
  )
  const stop = Math.min(distance, matEdgeDistance(start, dir, radius))
  const moved = hit < stop ? Math.max(0, hit - STOP_GAP) : stop
  return { moved }
}

// Distance along dir until the moving base (radius) touches the other base, edge to edge seen from
// above, or Infinity when it does not. The rules measure bases from above, so the height of the
// other base does not matter. A base that the move goes away from is not hit, also when the two
// touch at the start.
function baseHitDistance(start, dir, radius, other) {
  const wx = other.center.x - start.x
  const wz = other.center.z - start.z
  // Distance to the other center along the move, and across it
  const along = wx * dir.x + wz * dir.z
  const across = wx * dir.z - wz * dir.x
  const reach = radius + other.radius
  if (along <= 0 || Math.abs(across) >= reach) return Infinity
  return Math.max(0, along - Math.sqrt(reach * reach - across * across))
}

// Distance along dir until the base touches a terrain piece, or distance when it touches none.
// A cast of the base shape at startBottom, just above the ground where it starts. So a base on the
// table passes under an overhang, as the rules allow (p9), and a base on a roof does not hit the
// lower terrain under it.
function terrainHitDistance(world, rapier, start, dir, distance, radius, ground, startBottom) {
  const started = standingColliders(
    world,
    rapier,
    start,
    ground,
    radius - TOUCH_MARGIN,
    BASE_HALF_H,
  )
  const base = new rapier.Cylinder(BASE_HALF_H, radius)
  const pos = { x: start.x, y: startBottom + BASE_HALF_H, z: start.z }
  return castAlong(
    world,
    rapier,
    base,
    NO_ROTATION,
    pos,
    { x: dir.x, y: 0, z: dir.z },
    distance,
    (collider) => !started.has(collider.handle),
  )
}
