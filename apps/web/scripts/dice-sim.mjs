// Headless Rapier sim of the dice tray. Builds the same world as the app (see Scene.jsx: gravity,
// time step; table.js: table cuboid and edge walls; tray.js: tray collider; throw.js: throw and
// settle rules) and throws a die many times to measure fairness, tilt rate, out-of-well rate,
// settle time and step cost.
//
// It uses the app's own dice modules (faces.js, throw.js, tray.js), not a hand-built copy, so a
// bug in how the app builds colliders would show up here too (see the physics-sim-harness memory:
// an earlier hand-built sim for models missed a real bug for this reason).
//
// Run with `npm run dice-sim`. Options:
//   --seed <n>          RNG seed (default 1)
//   --throws <n>        valid throws for the single-die fairness test (default 8000)
//   --multi-throws <n>  valid throws (summed over 10 dice) for the multi-die test (default 2000)
//   --quick             small throw counts, for tuning (300 / 300)

import { createRequire } from 'node:module'
import path from 'node:path'
import { Quaternion, Vector3 } from 'three'
import { readGlb } from './lib/convert.mjs'
import { D8_CORNERS, D8_DENSITY } from '../src/dice/faces.js'
import { DIE_BODY, DIE_GRAVITY_SCALE, DIE_SOLVER_ITERATIONS, SETTLE_TIME, SETTLE_TIMEOUT, isFinitePoint, isFiniteQuat, isTilted, randomRotation, stillTime, throwVelocities, topFace } from '../src/dice/throw.js'
import { TRAYS, freeDropPoint, inWell, randomWellPoint, trayColliderArrays } from '../src/dice/tray.js'
import { FRICTION, WORLD_GRAVITY } from '../src/physics.js'
import { FALL_LIMIT_Y, TABLE_COLLIDER_HALF_H, TABLE_DEPTH, TABLE_WALLS, TABLE_WIDTH } from '../src/table.js'

// Nested Rapier build the app actually uses (0.14, enhanced determinism). The top-level
// @dimforge/rapier3d-compat is 0.12 and must not be used (see docs/plan-dice-rolling.md, Phase 3).
const RAPIER_PATH = createRequire(import.meta.resolve('@react-three/rapier')).resolve('@dimforge/rapier3d-compat/rapier.es.js')

// Same value as Scene.jsx. Not imported: Scene.jsx does not export it.
const TIME_STEP = 1 / 120

const TRAY_KEY = 'blue' // the red tray is the same shape, only mirrored, so one tray is enough here

function parseArgs(argv) {
  const opts = { seed: 1, throws: 8000, multiThrows: 2000, multiDice: 10, perfDice: 42 }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--seed') opts.seed = Number(argv[++i])
    else if (argv[i] === '--throws') opts.throws = Number(argv[++i])
    else if (argv[i] === '--multi-throws') opts.multiThrows = Number(argv[++i])
    else if (argv[i] === '--quick') { opts.throws = 300; opts.multiThrows = 300 }
  }
  return opts
}

// Seeded PRNG (mulberry32), so a run repeats exactly for a given --seed.
function mulberry32(seed) {
  let a = seed
  return function random() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function buildWorld(RAPIER) {
  const world = new RAPIER.World({ x: 0, y: WORLD_GRAVITY, z: 0 })
  world.timestep = TIME_STEP
  // world.numSolverIterations left at the Rapier default (4), same as Scene.jsx. Dice get extra
  // iterations of their own (DIE_SOLVER_ITERATIONS, see createDie), so this does not need to change.

  // Table, like Scene.jsx: a thick fixed cuboid, top at y = 0, friction 1 (FRICTION).
  const tableBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(TABLE_WIDTH / 2, TABLE_COLLIDER_HALF_H, TABLE_DEPTH / 2)
      .setTranslation(0, -TABLE_COLLIDER_HALF_H, 0)
      .setFriction(FRICTION),
    tableBody,
  )
  // Walls at the table edge, like Scene.jsx: one kinematic body, cuboids from table.js.
  const wallBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased())
  for (const { halfExtents, position } of TABLE_WALLS) {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(...halfExtents).setTranslation(...position).setFriction(FRICTION),
      wallBody,
    )
  }

  // Tray: fixed body at TRAYS[TRAY_KEY], trimesh collider from tray.glb via the app's own
  // trayColliderArrays (so this sim uses the exact same collider the app builds).
  const doc = await readGlb(path.resolve(import.meta.dirname, '../src/assets/dice/tray.glb'))
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0]
  const positions = prim.getAttribute('POSITION').getArray()
  const rawIndices = prim.getIndices().getArray()
  const { vertices, indices } = trayColliderArrays(positions, rawIndices)

  const tray = TRAYS[TRAY_KEY]
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), tray.yaw)
  const trayBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(tray.position.x, tray.position.y, tray.position.z).setRotation(rotation),
  )
  world.createCollider(
    RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(FRICTION),
    trayBody,
  )

  return world
}

// One die: a dynamic body with CCD on, extra solver iterations and its own gravity scale
// (DIE_SOLVER_ITERATIONS, DIE_GRAVITY_SCALE, see throw.js), and a convex hull collider of the
// app's own die shape (D8_CORNERS), with DIE_BODY's friction, restitution and damping.
const dieVertices = Float32Array.from(D8_CORNERS.flat())

function createDie(RAPIER, world, position) {
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(position.x, position.y, position.z)
    .setLinearDamping(DIE_BODY.linearDamping)
    .setAngularDamping(DIE_BODY.angularDamping)
    .setCcdEnabled(true)
    .setAdditionalSolverIterations(DIE_SOLVER_ITERATIONS)
    .setGravityScale(DIE_GRAVITY_SCALE)
  const body = world.createRigidBody(bodyDesc)
  const colliderDesc = RAPIER.ColliderDesc.convexHull(dieVertices)
    .setDensity(D8_DENSITY)
    .setFriction(DIE_BODY.friction)
    .setFrictionCombineRule(DIE_BODY.frictionCombineRule)
    .setRestitution(DIE_BODY.restitution)
    .setRestitutionCombineRule(DIE_BODY.restitutionCombineRule)
  world.createCollider(colliderDesc, body)
  return body
}

function throwDie(body, random) {
  const position = body.translation()
  const target = randomWellPoint(TRAY_KEY, random)
  const rotation = randomRotation(random)
  const { linvel, angvel } = throwVelocities(position, target, random)
  body.wakeUp()
  body.setRotation(rotation, true)
  body.setLinvel(linvel, true)
  body.setAngvel(angvel, true)
}

// Steps the world until this one die settles (stillTime reaches SETTLE_TIME) or times out
// (SETTLE_TIMEOUT). Only for the single-die test, where nothing else is moving.
function stepUntilRest(world, body) {
  const maxSteps = Math.round(SETTLE_TIMEOUT / TIME_STEP)
  let still = 0
  for (let steps = 1; steps <= maxSteps; steps++) {
    world.step()
    still = stillTime(still, body.linvel(), body.angvel(), TIME_STEP)
    if (still >= SETTLE_TIME) return { steps, timedOut: false }
  }
  return { steps: maxSteps, timedOut: true }
}

// The same rules as DiceTray.jsx (design, "Tilted dice"): a lost die (non-finite, or below the
// table) is thrown again from above the well. A tilted die, or one that did not rest in time, is
// thrown again from where it is. A flat die counts, in the well or outside it; outOfWell is only
// measured.
function classify(body, timedOut) {
  const t = body.translation()
  const rot = body.rotation()
  const lost = !isFinitePoint(t) || !isFiniteQuat(rot) || t.y < FALL_LIMIT_Y
  const { face, dot } = topFace(rot)
  const tilted = !lost && (timedOut || isTilted(dot))
  const outOfWell = !lost && !inWell(TRAY_KEY, t)
  return { face, lost, tilted, outOfWell }
}

// Counts one result into `stats` ({ counts, valid, lostCount, tiltedCount, outOfWellCount }).
// Returns whether the die must start its next throw from above the well: a lost die, and a die
// that counted outside the well (in the app it goes to the shelf, and comes back as a new die).
function countResult(stats, { face, lost, tilted, outOfWell }) {
  if (lost) {
    stats.lostCount++
    return true
  }
  if (tilted) {
    stats.tiltedCount++
    return false
  }
  stats.valid++
  stats.counts[face - 1]++
  if (outOfWell) stats.outOfWellCount++
  return outOfWell
}

function newStats() {
  return { counts: newFaceCounts(), attempts: 0, valid: 0, lostCount: 0, tiltedCount: 0, outOfWellCount: 0 }
}

function newFaceCounts() {
  return [0, 0, 0, 0, 0, 0, 0, 0]
}

function chiSquared(counts) {
  const total = counts.reduce((a, b) => a + b, 0)
  const expected = total / counts.length
  return counts.reduce((sum, n) => sum + (n - expected) ** 2 / expected, 0)
}

// 8000 throws of one die, reused: each throw starts from wherever the die last rested, so this
// also covers "throws of a die that rests" (design, Phase 3 step 2) — the die is always thrown
// again from its own resting pose, never respawned fresh.
function runSingle(RAPIER, world, random, target) {
  const body = createDie(RAPIER, world, freeDropPoint(TRAY_KEY, [], random))

  const stats = newStats()
  let needsRespawn = false

  while (stats.valid < target) {
    stats.attempts++
    if (needsRespawn) {
      body.setTranslation(freeDropPoint(TRAY_KEY, [], random), true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      needsRespawn = false
    }
    throwDie(body, random)
    const { steps: _steps, timedOut } = stepUntilRest(world, body)
    // A lost die must start again from above the well: a die whose position went non-finite
    // after an unstable contact (see the Result, "explosion") can never rest where it is.
    needsRespawn = countResult(stats, classify(body, timedOut))
  }

  world.removeRigidBody(body)
  return stats
}

// `diceCount` dice thrown together, round after round (like pressing Roll again on a full well),
// until `target` valid results have been collected in total. Also measures the settle time of
// each round (time until every die in that round has rested or timed out).
function runMulti(RAPIER, world, random, diceCount, target) {
  const bodies = []
  for (let i = 0; i < diceCount; i++) {
    bodies.push(createDie(RAPIER, world, freeDropPoint(TRAY_KEY, bodies.map(b => b.translation()), random)))
  }

  const stats = newStats()
  const needsRespawn = bodies.map(() => false)
  const settleTimes = []

  while (stats.valid < target) {
    bodies.forEach((body, i) => {
      if (needsRespawn[i]) {
        // The same move as DiceTray.jsx: a free point above the well, away from the other dice
        const others = bodies.filter(b => b !== body).map(b => b.translation())
        body.setTranslation(freeDropPoint(TRAY_KEY, others, random), true)
        body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        body.setAngvel({ x: 0, y: 0, z: 0 }, true)
        needsRespawn[i] = false
      }
      throwDie(body, random)
    })

    const maxSteps = Math.round(SETTLE_TIMEOUT / TIME_STEP)
    const still = bodies.map(() => 0)
    const done = bodies.map(() => false)
    const timedOut = bodies.map(() => false)
    let steps = 0
    let doneCount = 0
    while (doneCount < bodies.length && steps < maxSteps) {
      world.step()
      steps++
      bodies.forEach((body, i) => {
        if (done[i]) return
        still[i] = stillTime(still[i], body.linvel(), body.angvel(), TIME_STEP)
        if (still[i] >= SETTLE_TIME) { done[i] = true; doneCount++ }
      })
    }
    bodies.forEach((_, i) => { if (!done[i]) timedOut[i] = true })
    settleTimes.push(steps * TIME_STEP)

    bodies.forEach((body, i) => {
      stats.attempts++
      needsRespawn[i] = countResult(stats, classify(body, timedOut[i]))
    })
  }

  bodies.forEach(b => world.removeRigidBody(b))
  return { ...stats, settleTimes }
}

// Throws `diceCount` dice together once and measures wall-clock ms per world.step() while they
// are all active (the busiest case: a full tray of 42, right after Roll).
function runPerf(RAPIER, world, random, diceCount) {
  const bodies = []
  for (let i = 0; i < diceCount; i++) {
    bodies.push(createDie(RAPIER, world, freeDropPoint(TRAY_KEY, bodies.map(b => b.translation()), random)))
  }
  bodies.forEach(body => throwDie(body, random))

  const steps = 300 // 2.5 s of sim time at 120 Hz, covers the busy landing/settling period
  const t0 = performance.now()
  for (let i = 0; i < steps; i++) world.step()
  const ms = performance.now() - t0

  bodies.forEach(b => world.removeRigidBody(b))
  return { msPerStep: ms / steps }
}

function pct(n, total) {
  return total === 0 ? '0.0' : ((100 * n) / total).toFixed(1)
}

function reportFairness(label, result) {
  const chi = chiSquared(result.counts)
  const verdict = chi < 14.07 ? 'PASS' : 'FAIL'
  console.log(`${label}: ${result.valid} valid / ${result.attempts} attempts (tilted ${pct(result.tiltedCount, result.attempts)}%, out-of-well ${pct(result.outOfWellCount, result.attempts)}% (counted), lost ${pct(result.lostCount, result.attempts)}%)`)
  console.log(`  chi-squared (7 df, need < 14.07): ${chi.toFixed(2)} ${verdict}`)
  console.log(`  face counts: ${result.counts.map((n, i) => `${i + 1}:${n}`).join(' ')}`)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const RAPIER = await import(RAPIER_PATH)
  await RAPIER.init()

  console.log(`Dice sim — seed ${opts.seed}`)

  {
    const world = await buildWorld(RAPIER)
    const random = mulberry32(opts.seed)
    const result = runSingle(RAPIER, world, random, opts.throws)
    reportFairness('Single die', result)
    world.free()
  }

  {
    const world = await buildWorld(RAPIER)
    const random = mulberry32(opts.seed + 1)
    const result = runMulti(RAPIER, world, random, opts.multiDice, opts.multiThrows)
    reportFairness(`${opts.multiDice} dice at once`, result)
    const avg = result.settleTimes.reduce((a, b) => a + b, 0) / result.settleTimes.length
    const max = Math.max(...result.settleTimes)
    console.log(`  settle time per round: avg ${avg.toFixed(2)}s, max ${max.toFixed(2)}s, over ${result.settleTimes.length} rounds`)
    world.free()
  }

  {
    const world = await buildWorld(RAPIER)
    const random = mulberry32(opts.seed + 2)
    const result = runPerf(RAPIER, world, random, opts.perfDice)
    console.log(`${opts.perfDice} dice perf: ${result.msPerStep.toFixed(3)} ms/step`)
    world.free()
  }
}

await main()
