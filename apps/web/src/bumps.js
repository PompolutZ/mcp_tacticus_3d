// Finds the bumps of a piece from its velocity over time (docs/features/sounds.md). Plain code,
// no three.js and no Rapier, so node tests can run it. The caller feeds the velocity of a piece
// and the time since the last one; the source is free (a physics step, two live poses).

// Velocity change of a bump, in/s. Below DIE_BUMP_MIN there is no bump, at DIE_BUMP_MAX the
// strength is 1. Measured on thrown dice with scripts/dice-sim.mjs (docs/plans/table-sounds.md,
// Step 2): the first bump of a throw is 4 to 24 (p10 to p90), later bumps 0.5 to 8, a roll or a
// rest under 0.2.
export const DIE_BUMP_MIN = 1
export const DIE_BUMP_MAX = 20

// How far from gravity * dt the vertical velocity change of a free fall may be, in shares of it
const FALL_TOLERANCE = 0.5

// gravity: the fall of the piece, in/s² (positive). min, max: see DIE_BUMP_MIN.
// change(velocity, dt) takes { x, y, z } in/s and the seconds since the last call, and returns the
// velocity change of a bump in/s, or 0 for the first call after a reset. feed(velocity, dt) gives
// the strength of that change from 0 to 1, or 0 for no bump (under min). reset() forgets the last
// velocity: the next call only remembers, so a switch or a jump is never a bump. vertical: only the
// change of the vertical velocity counts. A model that a hand drags and lets go changes its
// horizontal velocity at once, and that is no bump.
export function createBumpFinder({
  gravity,
  min = DIE_BUMP_MIN,
  max = DIE_BUMP_MAX,
  vertical = false,
}) {
  let last = null
  let fell = false
  let fellBefore = false
  let wasFalling = false
  const strength = (change) => (change < min ? 0 : Math.min(1, (change - min) / (max - min)))
  function change({ x, y, z }, dt) {
    if (!Number.isFinite(x + y + z) || !(dt > 0)) {
      last = null
      return 0
    }
    const before = last
    last = { x, y, z }
    wasFalling = fell || fellBefore
    fellBefore = fell
    fell = false
    if (!before) return 0
    fell =
      Math.abs(y - (before.y - gravity * dt)) <=
      FALL_TOLERANCE * gravity * dt + 0.15 * Math.abs(before.y)
    // No bump is a free fall (gravity adds to the velocity) or an unchanged velocity (a
    // support holds the piece, so gravity adds nothing). A bump is far from both.
    const dx = vertical ? 0 : x - before.x
    const dz = vertical ? 0 : z - before.z
    const fall = Math.hypot(dx, y - (before.y - gravity * dt), dz)
    const same = Math.hypot(dx, y - before.y, dz)
    return Math.min(fall, same)
  }
  return {
    change,
    strength,
    // After change(): the piece was in a free fall in one of the two velocity changes before that
    // call (a change of gravity * dt, within a tolerance that grows with the speed, for the noise of
    // poses). Two, because the change that stops a fall is not a fall itself, and a stop can fall in
    // two samples.
    wasFalling: () => wasFalling,
    feed: (velocity, dt) => strength(change(velocity, dt)),
    reset() {
      last = null
      fell = false
      fellBefore = false
      wasFalling = false
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
// mergeMs: a heavy piece stops at once, and the stop falls in two samples (a part of the change in
// the one where it hits, the rest in the next). With mergeMs > 0 the changes of the samples within
// mergeMs of the first one are added, and the bump is given mergeMs after the first one: by the
// feed of a later pose or by poll(time), which the caller calls every frame. A sample under min / 3 does not start or join a bump. With 0 each
// sample is a bump alone.
// restMs: a piece at rest sends no pose, so a stop is not in the poses. When no pose has come for
// restMs, poll(time) feeds the last position again, at the time of the last pose + restMs: a
// velocity of zero. 0 is off.
// afterFall: a bump starts only after a free fall. A model that a hand lifts, lowers or drags
// stops with a change of velocity too, but it does not fall by gravity before it.
export function createPoseBumpFinder({
  gravity,
  min = REMOTE_DIE_BUMP_MIN,
  max = REMOTE_DIE_BUMP_MAX,
  gapMs = REMOTE_GAP_MS,
  maxSpeed = REMOTE_DIE_MAX_SPEED,
  mergeMs = 0,
  restMs = 0,
  vertical = false,
  afterFall = false,
}) {
  const finder = createBumpFinder({ gravity, min, max, vertical })
  let last = null
  let pending = null
  function due(time) {
    if (!pending || time - pending.time < mergeMs) return 0
    const strength = finder.strength(pending.sum)
    pending = null
    return strength
  }
  function feed({ x, y, z }, time) {
    if (!Number.isFinite(x + y + z + time)) return 0
    if (last && time <= last.time) return 0
    const before = last
    last = { x, y, z, time, rested: false }
    let change = 0
    if (before && time - before.time <= gapMs) {
      const dt = (time - before.time) / 1000
      const v = { x: (x - before.x) / dt, y: (y - before.y) / dt, z: (z - before.z) / dt }
      if (Math.hypot(v.x, v.y, v.z) > maxSpeed) finder.reset()
      else change = finder.change(v, dt)
      if (afterFall && !pending && !finder.wasFalling()) change = 0
    } else {
      finder.reset()
    }
    if (!mergeMs) return finder.strength(change)
    const out = due(time)
    if (change >= min / 3) {
      pending ??= { sum: 0, time }
      pending.sum += change
    }
    return out
  }
  return {
    feed,
    // Call it every frame with the time now. Gives the bump that waits (mergeMs), and feeds the
    // stop of a piece that sends no more poses (restMs).
    poll(time) {
      let out = 0
      if (restMs && last && !last.rested && time - last.time >= restMs) {
        const { x, y, z } = last
        out = feed({ x, y, z }, last.time + restMs)
        last.rested = true
      }
      return Math.max(out, due(time))
    },
    // Forgets the bump that waits, and keeps the rest
    discard() {
      pending = null
    },
    reset() {
      last = null
      pending = null
      finder.reset()
    },
  }
}

// Models (docs/plans/table-sounds.md, Step 4). A model is heavy and stops dead on landing, so a
// landing is one change of the vertical velocity, as big as the speed of the fall: 4.2 in/s from
// the drag height (0.3"), 7.7 from 1", 17 from 5". Measured with a headless Rapier world, with the
// body of the app. Settling and rocking bumps after a landing are under 1 in/s, an edge of terrain
// gives a second landing of 1.5 to 11. A model that is dragged is kinematic and is not fed.
export const MODEL_BUMP_MIN = 1.5
export const MODEL_BUMP_MAX = 6
// The other player's model: the poses show about 0.85 of the change (the stop falls in two
// samples, and the merge adds them). The minimum stays, the maximum is lower.
export const REMOTE_MODEL_BUMP_MIN = 1.5
export const REMOTE_MODEL_BUMP_MAX = 5
// The two samples of a stop are at most about 50 ms apart (a pose every 33 to 50 ms), and the
// piece sends nothing after the stop, so a rest is read after 60 ms with no pose.
export const REMOTE_MODEL_REST_MS = 60
export const REMOTE_MODEL_MERGE_MS = 90
// A fall of 30" is 42 in/s. A hand drags faster, and that is no fall.
export const REMOTE_MODEL_MAX_SPEED = 60
