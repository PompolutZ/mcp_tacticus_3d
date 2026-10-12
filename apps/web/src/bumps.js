// Finds the bumps of a piece from its velocity over time (docs/features/sounds.md). Plain code,
// no three.js and no Rapier, so node tests can run it. The caller feeds the velocity of a piece
// and the time since the last one; the source is free (a physics step, two live poses).

// Velocity change of a bump, in/s. Below DIE_BUMP_MIN there is no bump, at DIE_BUMP_MAX the
// strength is 1. Measured on thrown dice with scripts/dice-sim.mjs (docs/plans/table-sounds.md,
// Step 2): the first bump of a throw is 4 to 24 (p10 to p90), later bumps 0.5 to 8, a roll or a
// rest under 0.2.
export const DIE_BUMP_MIN = 1
export const DIE_BUMP_MAX = 20

// gravity: the fall of the piece, in/s² (positive). min, max: see DIE_BUMP_MIN.
// feed(velocity, dt) takes { x, y, z } in/s and the seconds since the last feed, and returns the
// strength of a bump from 0 to 1, or 0 for no bump. reset() forgets the last velocity: the next
// feed only remembers, so a switch or a jump is never a bump.
export function createBumpFinder({ gravity, min = DIE_BUMP_MIN, max = DIE_BUMP_MAX }) {
  let last = null
  return {
    feed({ x, y, z }, dt) {
      if (!Number.isFinite(x + y + z) || !(dt > 0)) {
        last = null
        return 0
      }
      const before = last
      last = { x, y, z }
      if (!before) return 0
      // No bump is a free fall (gravity adds to the velocity) or an unchanged velocity (a
      // support holds the piece, so gravity adds nothing). A bump is far from both.
      const fall = Math.hypot(x - before.x, y - (before.y - gravity * dt), z - before.z)
      const same = Math.hypot(x - before.x, y - before.y, z - before.z)
      const change = Math.min(fall, same)
      if (change < min) return 0
      return Math.min(1, (change - min) / (max - min))
    },
    reset() {
      last = null
    },
  }
}
