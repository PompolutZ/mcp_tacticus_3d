// Throw and Push (README "Throw / Push"): how far a base moves along a straight movement tool.
// The rules (p13–14) move a Thrown and a Pushed character the same way. The base stays centered on
// the tool, and it stops when it touches another character's base or a terrain piece. Only a Throw
// causes collision damage, and the players resolve that themselves.

import { BASE_HALF_H, baseGroundY } from './CharacterModel.jsx'
import { castAlong, castDown } from '../physics.js'
import { MAT_SIZE } from '../table.js'

const NO_ROTATION = { x: 0, y: 0, z: 0, w: 1 }
// The base moves this far (inches) above the ground where it starts, so the terrain cast does not hit
// the surface that the base stands on
const CAST_LIFT = 0.05
// Terrain that the base overlaps at the start does not stop it (rules p14). The test shape is the
// base, reaching STAND_DEPTH below it, so the piece that the base stands on counts.
const STAND_DEPTH = 0.05
// The ground at the start and the start overlap test use a base this much narrower. So a wall that
// the base only touches is not under it, and the base does not start on top of that wall.
const TOUCH_MARGIN = 0.02
// A base that hits something stops this far (inches) before it, so physics does not push the two apart
const STOP_GAP = 0.005
// The slide of a full move takes full distance / SLIDE_SPEED seconds, and at least SLIDE_MIN_TIME.
// Picked without a look in the app, not measured in TTS.
const SLIDE_SPEED = 15
const SLIDE_MIN_TIME = 0.2

// start: base center at the start (table XZ). dir: unit XZ vector of the move. distance: the full move.
// radius: base radius. others: the bases of the other characters, [{ center, radius }].
// Returns { moved, at }. moved: how far the base moves, the full distance or less when it touches a
// base, terrain or the mat edge first. at(d): the body position (base bottom center) at distance d
// along the move, with y null when nothing is under it (see landingY).
export function throwMove(world, rapier, { start, dir, distance, radius, others }) {
  const ground = baseGroundY(world, rapier, start.x, start.z, radius - TOUCH_MARGIN)
  const slideBottom = ground === null ? null : ground + CAST_LIFT
  const hit = Math.min(
    slideBottom === null ? Infinity : terrainHitDistance(world, rapier, start, dir, distance, radius, ground, slideBottom),
    ...others.map(other => baseHitDistance(start, dir, radius, other)),
  )
  const stop = Math.min(distance, matEdgeDistance(start, dir, radius))
  const moved = hit < stop ? Math.max(0, hit - STOP_GAP) : stop
  function at(d) {
    const p = { x: start.x + dir.x * d, z: start.z + dir.z * d }
    return { ...p, y: landingY(world, rapier, p, radius, slideBottom) }
  }
  return { moved, at }
}

// The slide of a move (see startSlide in CharacterModel.jsx), from throwMove's at, the full distance
// and moved. The base starts fast and slows down evenly, as if friction stops it at the full distance.
// A base that hits something first stops at once at that point of the same slide.
// Returns { path, duration }: path(f) is the body position at the share f (0..1) of the duration.
export function throwSlide(at, distance, moved) {
  const fullTime = Math.max(SLIDE_MIN_TIME, distance / SLIDE_SPEED)
  // Distance at the share u of fullTime: distance * (1 - (1 - u)²). share: u where it reaches moved.
  const share = 1 - Math.sqrt(Math.max(0, 1 - moved / distance))
  return {
    path: f => at(distance * (1 - (1 - f * share) ** 2)),
    duration: fullTime * share,
  }
}

// A base never leaves the mat (rules p13). Distance along dir until the base edge reaches the mat edge.
// The mat turns only by 90° around its center, so its edges stay at ±MAT_SIZE / 2.
function matEdgeDistance(start, dir, radius) {
  const limit = MAT_SIZE / 2 - radius
  let d = Infinity
  for (const axis of ['x', 'z']) {
    if (dir[axis] === 0) continue
    d = Math.min(d, ((dir[axis] > 0 ? limit : -limit) - start[axis]) / dir[axis])
  }
  return Math.max(0, d)
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
// A cast of the base shape at slideBottom, just above the ground where it starts. So a base on the
// table passes under an overhang, as the rules allow (p9), and a base on a roof does not hit the
// lower terrain under it.
function terrainHitDistance(world, rapier, start, dir, distance, radius, ground, slideBottom) {
  const started = new Set()
  const stand = new rapier.Cylinder(BASE_HALF_H + STAND_DEPTH / 2, radius - TOUCH_MARGIN)
  const standPos = { x: start.x, y: ground + BASE_HALF_H - STAND_DEPTH / 2, z: start.z }
  const filter = rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS
  world.intersectionsWithShape(standPos, NO_ROTATION, stand, collider => {
    started.add(collider.handle)
    return true
  }, filter)
  const base = new rapier.Cylinder(BASE_HALF_H, radius)
  const pos = { x: start.x, y: slideBottom + BASE_HALF_H, z: start.z }
  return castAlong(world, rapier, base, NO_ROTATION, pos, { x: dir.x, y: 0, z: dir.z }, distance, collider => !started.has(collider.handle))
}

// Height of the base bottom at the end. The base moved at slideBottom, so it lands on what is below
// that height: a base on the table stays on the table when it stops under an overhang, and a base
// that left a roof drops onto what is under it. When the end is inside terrain that the base started
// on (stairs, a slope), or the start had no ground, the base stands on top of what is there.
function landingY(world, rapier, end, radius, slideBottom) {
  if (slideBottom !== null) {
    const y = castDown(world, rapier, new rapier.Cylinder(BASE_HALF_H, radius), NO_ROTATION, end.x, end.z, BASE_HALF_H, slideBottom)
    if (y !== null && y < slideBottom) return y
  }
  return baseGroundY(world, rapier, end.x, end.z, radius)
}
