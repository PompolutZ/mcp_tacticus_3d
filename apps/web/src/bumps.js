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

// The other player's pieces (docs/features/sounds.md): live poses arrive about every 33 ms, so a
// bump is a smaller change spread over a longer time. Measured with the dice-sim throws sampled
// every 33 ms (docs/plans/table-sounds.md, Step 3): the minimum stays, the maximum is lower.
export const REMOTE_DIE_BUMP_MIN = 1
export const REMOTE_DIE_BUMP_MAX = 12
// More than this between two arrivals (lost packets) starts fresh, in ms.
export const REMOTE_GAP_MS = 100
// A speed above this is a jump, not a move, in/s. A die is at most about 24 in/s in the sim.
export const REMOTE_DIE_MAX_SPEED = 40

// Like createBumpFinder, but fed with poses: feed({ x, y, z }, time) takes a position and the
// arrival time in ms. The velocity is the distance over the time between two arrivals. A pose
// that is not newer than the last one is skipped. A gap of more than gapMs, or a speed above
// maxSpeed, starts fresh with no bump. reset() starts fresh.
export function createPoseBumpFinder({
  gravity,
  min = REMOTE_DIE_BUMP_MIN,
  max = REMOTE_DIE_BUMP_MAX,
  gapMs = REMOTE_GAP_MS,
  maxSpeed = REMOTE_DIE_MAX_SPEED,
}) {
  const finder = createBumpFinder({ gravity, min, max })
  let last = null
  return {
    feed({ x, y, z }, time) {
      if (!Number.isFinite(x + y + z + time)) return 0
      if (last && time <= last.time) return 0
      const before = last
      last = { x, y, z, time }
      if (!before || time - before.time > gapMs) {
        finder.reset()
        return 0
      }
      const dt = (time - before.time) / 1000
      const vx = (x - before.x) / dt
      const vy = (y - before.y) / dt
      const vz = (z - before.z) / dt
      if (Math.hypot(vx, vy, vz) > maxSpeed) {
        finder.reset()
        return 0
      }
      return finder.feed({ x: vx, y: vy, z: vz }, dt)
    },
    reset() {
      last = null
      finder.reset()
    },
  }
}
