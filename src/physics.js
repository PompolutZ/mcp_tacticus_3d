// Physics values and helpers shared by the table, the terrain, the models and the tools.

// TTS (Tabletop Simulator) gives every object friction 0.4. With 0.4 here, a model slides off slopes it
// stands on in TTS, such as the about 35° hood of the vibranium haller. 1.0 holds it on slopes up to 45°.
export const FRICTION = 1

// World gravity, in/s² (y). Models use it. Dice fall slower, as in TTS (DIE_GRAVITY_SCALE in
// src/dice/throw.js).
export const WORLD_GRAVITY = -30

// Ground casts go straight down from this height, in steps of CAST_STEP.
// One long cast can pass through a terrain hull without a hit (Rapier loses precision over a long
// distance), so a model or tool would end up inside that piece. Short casts do not miss.
const CAST_TOP = 100
const CAST_STEP = 5
const DOWN = { x: 0, y: -1, z: 0 }

// Top of the first fixed, non-sensor collider below the shape at (x, z), or null when there is none.
// halfHeight: half the shape's height, so the result is the height of the shape's bottom.
// from: height of the shape's bottom where the cast starts. A shape that already overlaps a collider
// there gets from.
export function castDown(world, rapier, shape, rotation, x, z, halfHeight, from = CAST_TOP) {
  const filter = rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS
  for (let top = from; top > -CAST_STEP; top -= CAST_STEP) {
    const hit = world.castShape({ x, y: top + halfHeight, z }, rotation, DOWN, shape, 0, CAST_STEP, true, filter)
    if (hit) return top - hit.time_of_impact
  }
  return null
}

// How far the shape at pos moves along the unit vector dir, up to maxDistance, before it touches a fixed,
// non-sensor collider for which keep(collider) is true. maxDistance when it touches none.
// In steps of CAST_STEP, for the same reason as castDown. A collider that the shape already overlaps at
// the start does not stop it while the shape moves out of it.
export function castAlong(world, rapier, shape, rotation, pos, dir, maxDistance, keep) {
  const filter = rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS
  for (let done = 0; done < maxDistance; done += CAST_STEP) {
    const from = { x: pos.x + dir.x * done, y: pos.y + dir.y * done, z: pos.z + dir.z * done }
    const step = Math.min(CAST_STEP, maxDistance - done)
    const hit = world.castShape(from, rotation, dir, shape, 0, step, false, filter, undefined, undefined, undefined, keep)
    if (hit) return done + hit.time_of_impact
  }
  return maxDistance
}
