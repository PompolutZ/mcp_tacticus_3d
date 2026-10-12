import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DIE_BUMP_MAX,
  DIE_BUMP_MIN,
  REMOTE_DIE_MAX_SPEED,
  createBumpFinder,
  createPoseBumpFinder,
} from './bumps.js'

const G = 25
const DT = 1 / 120
const still = { x: 0, y: 0, z: 0 }

function finder() {
  return createBumpFinder({ gravity: G })
}

// Feeds a list of velocities and returns the strengths
function run(f, velocities, dt = DT) {
  return velocities.map((v) => f.feed(v, dt))
}

test('the first feed only remembers', () => {
  assert.equal(finder().feed({ x: 0, y: -30, z: 0 }, DT), 0)
})

test('a free fall is no bump', () => {
  const f = finder()
  const out = run(
    f,
    Array.from({ length: 60 }, (_, i) => ({ x: 3, y: -G * DT * i, z: 0 })),
  )
  assert.deepEqual(
    out,
    out.map(() => 0),
  )
})

test('a fall that stops is a loud bump, then silence', () => {
  const f = finder()
  const out = run(f, [{ x: 0, y: -20, z: 0 }, { x: 0, y: -20 - G * DT, z: 0 }, still, still, still])
  assert.equal(out[0], 0)
  assert.equal(out[1], 0)
  assert.ok(out[2] > 0.9)
  assert.deepEqual(out.slice(3), [0, 0])
})

test('a bounce is a bump, a harder one is stronger', () => {
  const soft = finder()
  const hard = finder()
  const s = run(soft, [
    { x: 0, y: -4, z: 0 },
    { x: 0, y: 3, z: 0 },
  ])[1]
  const h = run(hard, [
    { x: 0, y: -12, z: 0 },
    { x: 0, y: 9, z: 0 },
  ])[1]
  assert.ok(s > 0 && h > s && h <= 1)
})

test('a roll on the tray is no bump', () => {
  const f = finder()
  // Held by the floor: vy stays 0, the speed along it falls slowly (damping)
  const out = run(
    f,
    Array.from({ length: 60 }, (_, i) => ({ x: 8 - i * 0.01, y: 0, z: 2 })),
  )
  assert.deepEqual(
    out,
    out.map(() => 0),
  )
})

test('a die at rest is no bump', () => {
  const f = finder()
  assert.deepEqual(run(f, [still, still, still, still]), [0, 0, 0, 0])
})

test('a change under the minimum is no bump, the minimum is not far from a bump', () => {
  const f = finder()
  f.feed(still, DT)
  assert.equal(f.feed({ x: DIE_BUMP_MIN - 0.01, y: 0, z: 0 }, DT), 0)
  const g = finder()
  g.feed(still, DT)
  assert.ok(g.feed({ x: DIE_BUMP_MIN + 0.5, y: 0, z: 0 }, DT) > 0)
})

test('the strength is 1 at the maximum and above', () => {
  const f = finder()
  f.feed(still, DT)
  assert.equal(f.feed({ x: DIE_BUMP_MAX, y: 0, z: 0 }, DT), 1)
  f.feed(still, DT)
  assert.equal(f.feed({ x: 100, y: 0, z: 0 }, DT), 1)
})

test('a sideways hit counts too', () => {
  const f = finder()
  f.feed({ x: 10, y: 0, z: 0 }, DT)
  assert.ok(f.feed({ x: -10, y: 0, z: 0 }, DT) > 0.9)
})

test('the gravity part follows dt', () => {
  // A fall of -5 in/s: no bump after 0.2 s of gravity 25, a bump after 1/120 s
  const slow = finder()
  slow.feed(still, 0.2)
  assert.equal(slow.feed({ x: 0, y: -5, z: 0 }, 0.2), 0)
  const fast = finder()
  fast.feed(still, DT)
  assert.ok(fast.feed({ x: 0, y: -5, z: 0 }, DT) > 0)
})

test('reset: the next feed is never a bump', () => {
  const f = finder()
  f.feed({ x: 0, y: -20, z: 0 }, DT)
  f.reset()
  assert.equal(f.feed(still, DT), 0)
  // and it works again afterwards
  assert.ok(f.feed({ x: 15, y: 0, z: 0 }, DT) > 0.5)
})

test('a velocity that is not finite or a dt that is not positive resets', () => {
  const f = finder()
  f.feed({ x: 0, y: -20, z: 0 }, DT)
  assert.equal(f.feed({ x: NaN, y: 0, z: 0 }, DT), 0)
  assert.equal(f.feed(still, DT), 0)
  f.feed({ x: 0, y: -20, z: 0 }, DT)
  assert.equal(f.feed(still, 0), 0)
  assert.equal(f.feed(still, DT), 0)
})

// The other player's pieces: poses every 33 ms
const MS = 33

function poseFinder() {
  return createPoseBumpFinder({ gravity: G })
}

// Feeds positions y at times 0, MS, 2 MS ... (x = z = 0) and returns the strengths
function runPoses(f, ys, t0 = 1000) {
  return ys.map((y, i) => f.feed({ x: 0, y, z: 0 }, t0 + i * MS))
}

test('poses: a fall that stops is a bump, a rest is quiet', () => {
  const f = poseFinder()
  const dt = MS / 1000
  // Falls at 20 in/s, then rests: the speed over one interval goes from 20 to 0
  const ys = [10, 10 - 20 * dt, 10 - 40 * dt, 10 - 40 * dt, 10 - 40 * dt, 10 - 40 * dt]
  const out = runPoses(f, ys)
  assert.deepEqual(out.slice(0, 3), [0, 0, 0])
  assert.ok(out[3] > 0.5)
  assert.deepEqual(out.slice(4), [0, 0])
})

test('poses: a half bump over one interval is still heard', () => {
  const f = poseFinder()
  const dt = MS / 1000
  // A bump of 6 in/s: more than the minimum, less than the maximum
  const ys = [0, 6 * dt, 12 * dt, 12 * dt, 12 * dt]
  const out = runPoses(f, ys)
  assert.ok(out[3] > 0 && out[3] < 1)
})

test('poses: a resting die is quiet', () => {
  assert.deepEqual(runPoses(poseFinder(), [0, 0, 0, 0, 0]), [0, 0, 0, 0, 0])
})

test('poses: a gap of more than 100 ms starts fresh', () => {
  const f = poseFinder()
  const dt = MS / 1000
  f.feed({ x: 0, y: 0, z: 0 }, 1000)
  f.feed({ x: 0, y: 20 * dt, z: 0 }, 1000 + MS)
  f.feed({ x: 0, y: 40 * dt, z: 0 }, 1000 + 2 * MS)
  // Packets lost: the next arrives 150 ms later, at rest. It only remembers.
  assert.equal(f.feed({ x: 0, y: 40 * dt, z: 0 }, 1000 + 2 * MS + 150), 0)
  // The next one has no velocity before it, so it only remembers too
  assert.equal(f.feed({ x: 0, y: 40 * dt, z: 0 }, 1000 + 3 * MS + 150), 0)
})

test('poses: a gap of exactly 100 ms still counts', () => {
  const f = poseFinder()
  f.feed({ x: 0, y: 0, z: 0 }, 1000)
  f.feed({ x: 0, y: 0, z: 0 }, 1100)
  f.feed({ x: 0, y: 2, z: 0 }, 1200)
  assert.ok(f.feed({ x: 0, y: 2, z: 0 }, 1300) > 0)
})

test('poses: a jump is no bump', () => {
  const f = poseFinder()
  const far = (REMOTE_DIE_MAX_SPEED * MS) / 1000 + 1
  const out = runPoses(f, [0, 0, far, far, far])
  assert.deepEqual(out, [0, 0, 0, 0, 0])
})

test('poses: an older or equal time is skipped', () => {
  const f = poseFinder()
  const dt = MS / 1000
  f.feed({ x: 0, y: 0, z: 0 }, 1000)
  f.feed({ x: 0, y: 20 * dt, z: 0 }, 1000 + MS)
  f.feed({ x: 0, y: 40 * dt, z: 0 }, 1000 + 2 * MS)
  // An old pose and a repeat of the last one change nothing
  assert.equal(f.feed({ x: 0, y: 99, z: 0 }, 1000 + MS), 0)
  assert.equal(f.feed({ x: 0, y: 99, z: 0 }, 1000 + 2 * MS), 0)
  assert.ok(f.feed({ x: 0, y: 40 * dt, z: 0 }, 1000 + 3 * MS) > 0.5)
})

test('poses: reset starts fresh', () => {
  const f = poseFinder()
  const dt = MS / 1000
  f.feed({ x: 0, y: 0, z: 0 }, 1000)
  f.feed({ x: 0, y: 20 * dt, z: 0 }, 1000 + MS)
  f.reset()
  assert.equal(f.feed({ x: 0, y: 20 * dt, z: 0 }, 1000 + 2 * MS), 0)
})

test('poses: a bad pose is skipped', () => {
  assert.equal(poseFinder().feed({ x: NaN, y: 0, z: 0 }, 1000), 0)
})

// Models: a free fall of a heavy piece in poses 33 ms apart, from a rest, g = 30 in/s²
const MG = 30
const MODEL_MS = 33
function fallY(t) {
  return Math.max(0, 1 - 0.5 * MG * t * t) // 1" high, released at t = 0
}
function modelFinder(extra = {}) {
  return createPoseBumpFinder({
    gravity: MG,
    min: 1.5,
    max: 5,
    maxSpeed: 60,
    gapMs: Infinity,
    mergeMs: 90,
    restMs: 60,
    vertical: true,
    afterFall: true,
    ...extra,
  })
}
// Feeds poses (only when the height changes, as the sender does), polls every 8 ms, and returns
// the strengths that came out
function runModel(f, heightAt, until = 1000, discard = false) {
  const out = []
  let sent = null
  let next = 0
  for (let ms = 0; ms < until; ms += 8) {
    if (ms >= next) {
      next += MODEL_MS
      const y = Math.round(heightAt(ms / 1000) * 1000) / 1000
      if (y !== sent) {
        sent = y
        const s = f.feed({ x: 0, y, z: 0 }, 1000 + ms)
        if (s > 0) out.push(s)
      }
    }
    const s = f.poll(1000 + ms)
    if (s > 0) out.push(s)
    if (discard) f.discard()
  }
  return out
}

test('model: a fall that stops is one bump, with no pose after the stop', () => {
  const f = modelFinder()
  f.feed({ x: 0, y: 1, z: 0 }, 500)
  const out = runModel(f, fallY)
  assert.equal(out.length, 1)
  assert.ok(out[0] > 0.5)
})

test('model: a harder fall is a stronger bump', () => {
  const low = modelFinder()
  low.feed({ x: 0, y: 0.3, z: 0 }, 500)
  const soft = runModel(low, (t) => Math.max(0, 0.3 - 0.5 * MG * t * t))
  const high = modelFinder()
  high.feed({ x: 0, y: 4, z: 0 }, 500)
  const hard = runModel(high, (t) => Math.max(0, 4 - 0.5 * MG * t * t))
  assert.equal(soft.length, 1)
  assert.equal(hard.length, 1)
  assert.ok(hard[0] > soft[0])
})

test('model: lowering with an ease out is no bump', () => {
  const f = modelFinder()
  f.feed({ x: 0, y: 6, z: 0 }, 500)
  assert.deepEqual(
    runModel(f, (t) => 6 * Math.exp(-t / 0.06)),
    [],
  )
})

test('model: lifting with an ease out is no bump', () => {
  const f = modelFinder()
  f.feed({ x: 0, y: 0, z: 0 }, 500)
  assert.deepEqual(
    runModel(f, (t) => 6 * (1 - Math.exp(-t / 0.06))),
    [],
  )
})

test('model: a slide along the table is no bump', () => {
  const f = modelFinder()
  const out = []
  for (let i = 0; i < 12; i++) {
    out.push(f.feed({ x: 15 * (i * 0.033 - 1.5 * (i * 0.033) ** 2), y: 0, z: 0 }, 1000 + i * 33))
    out.push(f.poll(1000 + i * 33 + 20))
  }
  assert.deepEqual(
    out.filter((s) => s > 0),
    [],
  )
})

test('model: discard drops the bump that waits', () => {
  const f = modelFinder()
  f.feed({ x: 0, y: 1, z: 0 }, 500)
  assert.deepEqual(runModel(f, fallY, 1000, true), [])
})

test('model: reset starts fresh', () => {
  const f = modelFinder()
  f.feed({ x: 0, y: 1, z: 0 }, 500)
  f.reset()
  assert.equal(f.feed({ x: 0, y: 0, z: 0 }, 1000), 0)
  assert.equal(f.poll(5000), 0)
})

test('finder: vertical ignores a change of the horizontal velocity', () => {
  const f = createBumpFinder({ gravity: G, vertical: true })
  f.feed({ x: 30, y: 0, z: 0 }, DT)
  assert.equal(f.feed({ x: 0, y: 0, z: 0 }, DT), 0)
  const all = createBumpFinder({ gravity: G })
  all.feed({ x: 30, y: 0, z: 0 }, DT)
  assert.ok(all.feed({ x: 0, y: 0, z: 0 }, DT) > 0.9)
})
