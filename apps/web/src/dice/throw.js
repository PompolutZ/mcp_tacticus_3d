// Throwing, settling and reading a die. Plain module, no React and no src/assets/index.js
// import, so scripts/dice-sim.mjs can use it in Node.
//
// Every function that needs random numbers takes `random`, a function that returns a number in
// [0, 1). The default reads real randomness from crypto.getRandomValues, so the app is not
// predictable. scripts/dice-sim.mjs passes a seeded one instead, so its measurements repeat.

import { Quaternion, Vector3 } from 'three'
import { WORLD_GRAVITY } from '../physics.js'
import { FACES } from './faces.js'

// Default random source: crypto.getRandomValues on a 32-bit int, scaled to [0, 1).
function cryptoRandom() {
  const buf = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buf)
  return buf[0] / 2 ** 32
}

// Physics body of a die, from the design ("Values"). Friction 0.6, the TTS die's (measured).
// Friction combines with Min (1), so the table, tray and terrain (friction 1) do not raise it.
// Restitution combines with Average (0).
// CoefficientCombineRule in @dimforge/rapier3d-compat: Average = 0, Min = 1.
export const DIE_BODY = {
  friction: 0.6,
  frictionCombineRule: 1,
  restitution: 0.8,
  restitutionCombineRule: 0,
  linearDamping: 0.1,
  angularDamping: 0.1,
}

// A die rests when its linear and angular speed stay below these limits for SETTLE_TIME seconds.
// A die that still moves after SETTLE_TIMEOUT seconds counts as resting tilted (see isTilted).
export const SETTLE_LINEAR = 0.2 // in/s
export const SETTLE_ANGULAR = 0.5 // rad/s
export const SETTLE_TIME = 0.25 // s
export const SETTLE_TIMEOUT = 8 // s

// A die is tilted when its top face is more than this many degrees from flat.
const TILT_LIMIT_DEG = 15
export const TILT_LIMIT_DOT = Math.cos((TILT_LIMIT_DEG * Math.PI) / 180)

// Gravity of a die, in/s², down: 25, the TTS gravity (Physics.getGravity(), measured on
// 2026-10-01). The world has WORLD_GRAVITY (-30) for the models, so a die body gets
// DIE_GRAVITY_SCALE.
export const DIE_GRAVITY = 25
export const DIE_GRAVITY_SCALE = DIE_GRAVITY / -WORLD_GRAVITY

// Upward speed at the start of a throw, in/s: the range of TTS roll() (measured on 2026-10-01).
// Gives a flight top about 2.4-7.6" above the start height (h = v² / (2 * DIE_GRAVITY)).
export const THROW_UP_MIN = 11
export const THROW_UP_MAX = 19.5

// Spin speed at the start of a throw, rad/s: 0-50, chosen by look. 50 is the TTS upper limit.
// TTS dice spin fast in the air. In TTS, getAngularVelocity() in the first frames after roll()
// read only 7.7-11 rad/s (2026-10-01), but with 7.7-11 the app's dice only tilted in the air and
// did not look like TTS (checked in the app, 2026-10-02). Why is not known yet:
// scripts/tts-dice-measure.lua now also measures the spin during the whole roll.
export const THROW_SPIN_MIN = 0
export const THROW_SPIN_MAX = 50

// Extra solver iterations for a die's rigid body only (@react-three/rapier's
// `additionalSolverIterations` prop), on top of the world's own `numSolverIterations` (4, the
// Rapier default, unchanged — see Scene.jsx). Phase 3 found the dice a lot less likely to explode
// (huge or NaN velocity) on a multi-die collision with it (see docs/feature-dice-rolling.md,
// "Headless"); kept, because it is cheap. Left at the Rapier default for every other body, so this
// does not change model physics. DiceTray.jsx sets it on every die.
export const DIE_SOLVER_ITERATIONS = 8

function lerp(random, min, max) {
  return min + random() * (max - min)
}

// A unit vector with a uniform random direction.
function randomUnitVector(random) {
  const z = 2 * random() - 1
  const theta = 2 * Math.PI * random()
  const r = Math.sqrt(Math.max(0, 1 - z * z))
  return new Vector3(r * Math.cos(theta), r * Math.sin(theta), z)
}

// A uniform random rotation, Shoemake's method (Ken Shoemake, "Uniform random rotations",
// Graphics Gems III, 1992). Three random Euler angles are not uniform, so the app does not use
// them (see the design, "Throw"). Returns a plain quaternion { x, y, z, w }, the shape Rapier uses.
export function randomRotation(random = cryptoRandom) {
  const theta1 = 2 * Math.PI * random()
  const theta2 = 2 * Math.PI * random()
  const x0 = random()
  const r1 = Math.sqrt(1 - x0)
  const r2 = Math.sqrt(x0)
  return {
    x: r1 * Math.sin(theta1),
    y: r1 * Math.cos(theta1),
    z: r2 * Math.sin(theta2),
    w: r2 * Math.cos(theta2),
  }
}

// A spin around a random axis, THROW_SPIN_MIN..MAX rad/s, as a plain { x, y, z } angular
// velocity. Part of every throw. Roll also gives it alone to a die that is high in the air
// (ROLL_HEIGHT_LIMIT in tray.js), as TTS does.
export function randomSpin(random = cryptoRandom) {
  const spin = randomUnitVector(random).multiplyScalar(lerp(random, THROW_SPIN_MIN, THROW_SPIN_MAX))
  return { x: spin.x, y: spin.y, z: spin.z }
}

// New linear and angular velocity for a throw from `position` toward `target` (both { x, y, z }
// points in world space). Upward speed from THROW_UP_MIN..MAX. Sideways speed toward target,
// sized so the die crosses target.y at about the time it would land there. Spin from randomSpin.
// Called again for a die that is already in the air: the new velocities replace the old ones, so
// it changes direction from where it is.
export function throwVelocities(position, target, random = cryptoRandom) {
  const gravity = DIE_GRAVITY
  const up = lerp(random, THROW_UP_MIN, THROW_UP_MAX)
  // Time to fall from this height, with this upward speed, to target.y:
  // target.y = position.y + up * t - 0.5 * gravity * t^2, take the positive (falling) root.
  const dy = position.y - target.y
  const fallTime = (up + Math.sqrt(up * up + 2 * gravity * dy)) / gravity
  const dx = target.x - position.x
  const dz = target.z - position.z
  const linvel = { x: dx / fallTime, y: up, z: dz / fallTime }
  return { linvel, angvel: randomSpin(random) }
}

const UP = new Vector3(0, 1, 0)
const scratchNormal = new Vector3()
const scratchQuat = new Quaternion()

// The face of the die (see faces.js) whose normal, turned by `rotation` ({ x, y, z, w }), is
// closest to straight up. Returns { face, dot }: face is the face number (1-8), dot is the
// cosine of the angle from up (1 = flat on that face, 0.82 = balanced on an edge).
export function topFace(rotation) {
  scratchQuat.set(rotation.x, rotation.y, rotation.z, rotation.w)
  let best = null
  let bestDot = -Infinity
  for (const face of FACES) {
    scratchNormal.set(...face.normal).applyQuaternion(scratchQuat)
    const dot = scratchNormal.dot(UP)
    if (dot > bestDot) {
      bestDot = dot
      best = face.number
    }
  }
  return { face: best, dot: bestDot }
}

// True when a dot product (from topFace) is more than 15 degrees from flat.
export function isTilted(dot) {
  return dot < TILT_LIMIT_DOT
}

// The settle rule (design, "Settle"): a die counts as still when both speeds stay under the
// SETTLE_LINEAR / SETTLE_ANGULAR limits. `prev` is the still time from the last step (0 when the
// die was moving). Returns the new still time: 0 when the die moves this step, otherwise
// `prev + dt`. The caller puts the die to rest once the return value reaches SETTLE_TIME, or
// treats it as resting tilted once it reaches SETTLE_TIMEOUT.
export function stillTime(prev, linvel, angvel, dt) {
  const linSpeed = Math.hypot(linvel.x, linvel.y, linvel.z)
  const angSpeed = Math.hypot(angvel.x, angvel.y, angvel.z)
  if (linSpeed < SETTLE_LINEAR && angSpeed < SETTLE_ANGULAR) return prev + dt
  return 0
}

// True when a point ({x, y, z}) has only finite numbers. A die's physics state can explode to
// NaN or Infinity on a bad collision (design, "Pitfalls"); the caller throws such a die again.
export function isFinitePoint(p) {
  return Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)
}

// True when a rotation ({x, y, z, w}) has only finite numbers.
export function isFiniteQuat(q) {
  return (
    Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z) && Number.isFinite(q.w)
  )
}
