// Physics values and helpers shared by the table, the terrain, the models and the tools.
import { interactionGroups } from '@react-three/rapier'

// TTS (Tabletop Simulator) gives every object friction 0.4. With 0.4 here, a model slides off slopes it
// stands on in TTS, such as the about 35° hood of the vibranium haller. 1.0 holds it on slopes up to 45°.
export const FRICTION = 1

// World gravity, in/s² (y). Models use it. Dice fall slower, as in TTS (DIE_GRAVITY_SCALE in
// src/dice/throw.js).
export const WORLD_GRAVITY = -30

// Collision groups of a model base. It is in group 1 and its filter leaves group 1 out, so models pass
// through models (README "Known bugs"). Terrain, tokens and dice stay in the default groups, which
// meet every group, so they still collide with it.
export const MODEL_GROUPS = interactionGroups(
  [1],
  [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
)

// Collision groups of the other player's dice. They are in group 2 and their filter leaves group 1 out,
// so they pass through models (MODEL_GROUPS). Nothing else uses group 2. Own dice, terrain and the trays
// stay in the default groups, which meet every group, so they still collide with the other dice. A
// kinematic body pushes a model with no force limit, so the other dice must not touch models.
export const OTHER_DICE_GROUPS = interactionGroups(
  [2],
  [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
)

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
    const hit = world.castShape(
      { x, y: top + halfHeight, z },
      rotation,
      DOWN,
      shape,
      0,
      CAST_STEP,
      true,
      filter,
    )
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
    const hit = world.castShape(
      from,
      rotation,
      dir,
      shape,
      0,
      step,
      false,
      filter,
      undefined,
      undefined,
      undefined,
      keep,
    )
    if (hit) return done + hit.time_of_impact
  }
  return maxDistance
}

// Solver groups of a collider: all groups give contact forces, none gives no forces. A model that the
// other player moves has none, so it pushes nothing (plan 09, decision 9).
export const SOLVER_ALL = 0xffffffff
export const SOLVER_NONE = 0
