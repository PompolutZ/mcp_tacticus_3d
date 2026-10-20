// Throw and Push (docs/features/range-movement-tools.md, "Throw / Push"): how far a base moves along a straight movement tool.
// The rules (p13–14) move a Thrown and a Pushed character the same way. The base stays centered on
// the tool, and it stops when it touches another character's base or a terrain piece. Only a Throw
// causes collision damage, and the players resolve that themselves.

import { BASE_HALF_H, NO_ROTATION, baseGroundY } from './base.js'
import { castAlong, castDown } from '../physics.js'
import { TOUCH_MARGIN, matEdgeDistance, standingColliders, standingSkip } from './terrainUnder.js'

// The base moves this far (inches) above the ground where it starts, so the terrain cast does not hit
// the surface that the base stands on
const CAST_LIFT = 0.05
// A terrain piece that the base overlaps at the start does not stop it (rules p14), with all its
// parts (colliders), see standingColliders.
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

// Advance on a bent tool (docs/features/range-movement-tools.md, "Advance"): the body position (base
// bottom center) for each XZ point of the path, as the slide needs it (slidePath). The height follows
// the ground: it is found as the old slide did, from the height where the base starts.
// Returns [{ x, y, z }], y null when nothing is under the point.
export function groundedPath(world, rapier, points, radius) {
  const [first] = points
  const ground = baseGroundY(world, rapier, first.x, first.z, radius - TOUCH_MARGIN)
  const slideBottom = ground === null ? null : ground + CAST_LIFT
  return points.map((p) => ({ x: p.x, y: landingY(world, rapier, p, radius, slideBottom), z: p.z }))
}

// Height of the base bottom at the end. The base moved at slideBottom, so it lands on what is below
// that height: a base on the table stays on the table when it stops under an overhang, and a base
// that left a roof drops onto what is under it. When the end is inside terrain that the base started
// on (stairs, a slope), or the start had no ground, the base stands on top of what is there.
function landingY(world, rapier, end, radius, slideBottom) {
  if (slideBottom !== null) {
    const y = castDown(
      world,
      rapier,
      new rapier.Cylinder(BASE_HALF_H, radius),
      NO_ROTATION,
      end.x,
      end.z,
      BASE_HALF_H,
      slideBottom,
    )
    if (y !== null && y < slideBottom) return y
  }
  return baseGroundY(world, rapier, end.x, end.z, radius)
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
  // The whole piece is one terrain feature: its other colliders (a duct on the roof) are ignored too
  const skip = standingSkip(world, started)
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
    (collider) => !skip(collider),
  )
}

// The slide of a move (docs/features/range-movement-tools.md; slide in CharacterModel.jsx).
// The base starts fast and slows down evenly, as if friction stops it at the end. Picked without a look
// in the app, not measured in TTS.
const SLIDE_SPEED = 15
const SLIDE_MIN_TIME = 0.2

// points: the polyline of the move, at least two body positions { x, y, z }. y is null when nothing is
// under the point (see baseGroundY in base.js); a segment with a null end has y null. The caller
// gives y, this does not look at the world.
// Returns { path, duration }. path(f): the body position at the share f (0..1) of the duration.
// duration: the full length / SLIDE_SPEED seconds, and at least SLIDE_MIN_TIME.
export function slidePath(points) {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.z - points[i].z))
  const total = lengths.reduce((sum, l) => sum + l, 0)
  function path(f) {
    // Distance along the polyline at the share f: total * (1 - (1 - f)²)
    let d = total * (1 - (1 - Math.min(1, Math.max(0, f))) ** 2)
    for (let i = 0; i < lengths.length; i++) {
      if (d <= lengths[i] || i === lengths.length - 1) {
        const a = points[i]
        const b = points[i + 1]
        const u = lengths[i] > 0 ? Math.min(1, d / lengths[i]) : 1
        const y = a.y === null || b.y === null ? null : a.y + (b.y - a.y) * u
        return { x: a.x + (b.x - a.x) * u, y, z: a.z + (b.z - a.z) * u }
      }
      d -= lengths[i]
    }
    return { ...points[0] }
  }
  return { path, duration: Math.max(SLIDE_MIN_TIME, total / SLIDE_SPEED) }
}
