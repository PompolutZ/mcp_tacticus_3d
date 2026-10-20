import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ANGLE_LIMIT,
  advancePath,
  CONTACT_EPS,
  aimPose,
  alongHalf,
  anglePose,
  limitTurn,
  nearerCorner,
  sameMark,
  snapPlacement,
  snapPose,
  snapPoseOne,
  spawnPose,
  throwLine,
  toolShape,
  turnAround,
  withinRangeOne,
  yawTo,
} from './toolGeometry.js'

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`)
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
const dir = (yaw) => ({ x: Math.cos(yaw), z: -Math.sin(yaw) })

test('turnAround keeps the distance to the pivot and adds the yaw', () => {
  const pose = { x: 3, z: 1, yaw: 0.2 }
  const pivot = { x: 1, z: -1 }
  const r = turnAround(pose, pivot, 0.9)
  near(dist(r, pivot), dist(pose, pivot))
  near(r.yaw, 1.1)
})

test('snapPose: the left end touches the base along yaw', () => {
  const p = snapPose({ x: 2, z: 3 }, 0.7, 3, 0.5, 'left')
  near(p.yaw, 0.5)
  near(dist(p, { x: 2, z: 3 }), 3.7)
  const d = dir(0.5)
  near(p.x, 2 + 3.7 * d.x)
  near(p.z, 3 + 3.7 * d.z)
})

test('snapPose: the right side turns the tool half a turn', () => {
  const p = snapPose({ x: 2, z: 3 }, 0.7, 3, 0.5, 'right')
  near(p.yaw, 0.5 + Math.PI)
  near(dist(p, { x: 2, z: 3 }), 3.7)
})

test('snapPose without a yaw points to the mat center', () => {
  const c = { x: 5, z: 0 }
  const p = snapPose(c, 0.7, 3, undefined)
  assert.ok(dist(p, { x: 0, z: 0 }) < dist(c, { x: 0, z: 0 }))
  near(p.z, 0)
  near(p.yaw, yawTo(c, { x: 0, z: 0 }))
})

test('anglePose puts both arm lines at radius + halfWidth from the base', () => {
  const c = { x: 4, z: -2 }
  const radius = 0.7,
    halfWidth = 0.279
  const openYaw = 0.6
  const p = anglePose(c, radius, halfWidth, openYaw)
  // The arms run from the hinge along yaw + PI/4 and yaw - PI/4 (angle tool, both bent to a right angle)
  for (const arm of [p.yaw + Math.PI / 4, p.yaw - Math.PI / 4 + Math.PI]) {
    const a = dir(arm)
    // Distance of the base from the arm center line (2D cross product)
    const off = Math.abs((c.x - p.x) * a.z - (c.z - p.z) * a.x)
    near(off, radius + halfWidth)
  }
})

test('aimPose: away puts the hinge between the base and the point, toward the other side', () => {
  const c = { x: 0, z: 0 },
    pt = { x: 10, z: 0 }
  const away = aimPose(c, 0.7, 0.3, pt, 'away')
  const toward = aimPose(c, 0.7, 0.3, pt, 'toward')
  assert.ok(away.x > 0)
  assert.ok(toward.x < 0)
  near(dist(away, c), dist(toward, c))
})

test('limitTurn clamps to ±45° around openYaw', () => {
  near(limitTurn(0, 0, 0.3), 0.3)
  near(limitTurn(0, 0, 2), ANGLE_LIMIT)
  near(limitTurn(0, 0, -2), -ANGLE_LIMIT)
  // Already 0.5 from the middle: only the rest up to the limit
  near(limitTurn(0.5, 0, 1), ANGLE_LIMIT - 0.5)
})

test('snapPoseOne: at the mat center and off it', () => {
  const at = snapPoseOne({ x: 0, z: 0 }, 0.7, 3, 0.5)
  assert.ok(Number.isFinite(at.x) && Number.isFinite(at.z) && Number.isFinite(at.yaw))
  const c = { x: 6, z: 0 }
  const p = snapPoseOne(c, 0.7, 3, 0.5)
  // The tool lies on the side of the base toward the mat center
  assert.ok(p.x < c.x)
  // Local +Z points away from the mat center, so the yaw is a quarter turn around
  near(Math.cos(p.yaw), 0)
})

test('throwLine start, direction and distance', () => {
  const shape = toolShape({ x: 1, z: 2, yaw: 0 }, { right: 0, left: 0 })
  const l = throwLine(shape, 'right', 3, 0.7)
  near(l.distance, 7.4)
  near(l.start.x, 1 + 3.7)
  near(l.start.z, 2)
  near(l.dir.x, -1)
  near(l.dir.z, 0)
})

test('nearerCorner for four points', () => {
  const pose = { x: 0, z: 0, yaw: 0 }
  assert.deepEqual(nearerCorner(pose, { x: 1, z: 1 }), { end: 1, across: 1 })
  assert.deepEqual(nearerCorner(pose, { x: -1, z: 1 }), { end: -1, across: 1 })
  assert.deepEqual(nearerCorner(pose, { x: 1, z: -1 }), { end: 1, across: -1 })
  assert.deepEqual(nearerCorner(pose, { x: -1, z: -1 }), { end: -1, across: -1 })
})

test('withinRangeOne at the edge counts with CONTACT_EPS', () => {
  const base = (x, radius) => ({ getCenter: () => ({ x, z: 0 }), radius })
  const a = base(0, 0.7)
  // Edge to edge gap is exactly Range 1
  assert.ok(withinRangeOne(a, base(2.4, 0.7)))
  assert.ok(withinRangeOne(a, base(2.4 + CONTACT_EPS / 2, 0.7)))
  assert.ok(!withinRangeOne(a, base(2.4 + CONTACT_EPS * 2, 0.7)))
})

test('sameMark: null, same piece and mode', () => {
  assert.ok(sameMark(null, null))
  assert.ok(sameMark({ kind: 'c', id: 1, mode: 'inRange' }, { kind: 'c', id: 1, mode: 'inRange' }))
  assert.ok(!sameMark(null, { kind: 'c', id: 1, mode: 'inRange' }))
  assert.ok(
    !sameMark({ kind: 'c', id: 1, mode: 'inRange' }, { kind: 'c', id: 1, mode: 'outOfRange' }),
  )
})

const spawnBase = { center: { x: 4, z: 0 }, radius: 0.6, tip: 3, halfWidth: 0.5 }

test('spawnPose: range tool left end, movement tool right end, angle tool aims', () => {
  const range = spawnPose({ ...spawnBase, angle: false, rangeOne: false, bendable: false })
  assert.deepEqual(range, snapPose(spawnBase.center, 0.6, 3, undefined, 'left'))
  const move = spawnPose({ ...spawnBase, angle: false, rangeOne: false, bendable: true, open: 0.5 })
  assert.deepEqual(move, snapPose(spawnBase.center, 0.6, 3, 0.5, 'right'))
  const one = spawnPose({ ...spawnBase, angle: false, rangeOne: true, bendable: false })
  assert.deepEqual(one, snapPoseOne(spawnBase.center, 0.6, 3, 0.5))
  const aimed = spawnPose({
    ...spawnBase,
    angle: true,
    rangeOne: false,
    bendable: false,
    aimPoint: { x: 4, z: 5 },
  })
  assert.deepEqual(aimed, aimPose(spawnBase.center, 0.6, 0.5, { x: 4, z: 5 }, 'away'))
  const mat = spawnPose({ ...spawnBase, angle: true, rangeOne: false, bendable: false })
  assert.deepEqual(mat, aimPose(spawnBase.center, 0.6, 0.5, { x: 0, z: 0 }, 'away'))
})

const place = { tip: 3, halfWidth: 0.5, open: null }
const straight = { right: 0, left: 0 }

test('snapPlacement: range tool snaps the nearer end, no flip', () => {
  const r = snapPlacement({ x: 0, z: 0, yaw: 0 }, straight, { x: 6, z: 0 }, 0.6, {
    ...place,
    angle: false,
    rangeOne: false,
    bendable: false,
  })
  assert.equal(r.side, 'right')
  assert.equal(r.flipped, null)
  assert.equal(r.across, undefined)
  near(r.x, 6 - 3.6)
  near(r.z, 0)
  near(r.yaw, 0)
})

test('snapPlacement: movement tool flips to snap with its right end', () => {
  const r = snapPlacement({ x: 0, z: 0, yaw: 0 }, straight, { x: -6, z: 0 }, 0.6, {
    ...place,
    angle: false,
    rangeOne: false,
    bendable: true,
  })
  assert.equal(r.side, 'right')
  assert.ok(r.flipped)
  near(r.flipped.pose.yaw, Math.PI)
  near(r.yaw, Math.PI)
  near(r.x, -6 + 3.6)
})

test('snapPlacement: movement tool at an angle tool keeps within the open angle', () => {
  const free = snapPlacement({ x: 0, z: 0, yaw: 0 }, straight, { x: 6, z: 0 }, 0.6, {
    ...place,
    angle: false,
    rangeOne: false,
    bendable: true,
  })
  const cut = snapPlacement({ x: 0, z: 0, yaw: 0 }, straight, { x: 6, z: 0 }, 0.6, {
    ...place,
    angle: false,
    rangeOne: false,
    bendable: true,
    open: Math.PI / 2,
  })
  assert.ok(Math.abs(cut.yaw - free.yaw) > 0.1 || Math.abs(cut.z - free.z) > 0.1)
  near(dist(cut, { x: 6, z: 0 }), dist(free, { x: 6, z: 0 }))
})

test('snapPlacement: range 1 snaps with the nearer corner and gives across', () => {
  const pose = { x: 0, z: 0, yaw: 0 }
  const r = snapPlacement(pose, straight, { x: 6, z: 1 }, 0.6, {
    ...place,
    angle: false,
    rangeOne: true,
    bendable: false,
  })
  const corner = nearerCorner(pose, { x: 6, z: 1 })
  assert.equal(r.across, corner.across)
  assert.equal(r.side, corner.end > 0 ? 'right' : 'left')
  assert.equal(r.yaw, 0)
})

test('snapPlacement: angle tool keeps its yaw, side left, no across', () => {
  const r = snapPlacement({ x: 0, z: 0, yaw: 0.4 }, straight, { x: 6, z: 0 }, 0.6, {
    ...place,
    angle: true,
    rangeOne: false,
    bendable: false,
  })
  const arms = anglePose({ x: 6, z: 0 }, 0.6, 0.5, 0.4 + Math.PI / 2)
  near(r.x, arms.x)
  near(r.z, arms.z)
  near(r.yaw, 0.4)
  assert.equal(r.side, 'left')
  assert.equal(r.flipped, null)
  assert.equal('across' in r, false)
})

test('advancePath passes the hinge and ends on the far half center line, base touching its end', () => {
  const shape = toolShape({ x: 2, z: -1, yaw: 0.3 }, { right: 0, left: 0 })
  const from = alongHalf(shape, 'left', 2.5)
  const path = advancePath(shape, 'left', 4, 0.6, from)
  assert.equal(path.length, 3)
  assert.deepEqual(path[1], { x: shape.x, z: shape.z })
  near(dist(path[2], path[1]), 4.6)
  // On the far half center line: the direction from the hinge is the far half yaw
  near(path[2].x - shape.x, 4.6 * Math.cos(shape.right))
  near(path[2].z - shape.z, -4.6 * Math.sin(shape.right))
})

test('advancePath of a straight tool is a straight line', () => {
  const shape = toolShape({ x: 0, z: 0, yaw: 1 }, { right: 0, left: 0 })
  const [a, b, c] = advancePath(shape, 'right', 3, 0.5, alongHalf(shape, 'right', 3.5))
  const cross = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x)
  near(cross, 0)
  near(dist(a, c), 7)
})

test('advancePath of a bent tool follows the yaw of the far half', () => {
  const shape = toolShape({ x: 0, z: 0, yaw: 0 }, { right: 0, left: 0.5 })
  const path = advancePath(shape, 'right', 3, 0.5, alongHalf(shape, 'right', 3.5))
  const dx = path[2].x - path[1].x
  const dz = path[2].z - path[1].z
  near(dx / Math.hypot(dx, dz), Math.cos(shape.left))
  near(-dz / Math.hypot(dx, dz), Math.sin(shape.left))
})
