import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aimTurn, aimDir, followPose } from './aimTurn.js'
import { snapPlacement, toolShape } from './toolGeometry.js'
import { footprintGap, placeClamp, touches } from './placeLock.js'

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
// Yaw of a world direction, same convention as the tool: x = cos, z = -sin
const dirOf = (yaw, l) => ({
  x: l.x * Math.cos(yaw) + l.z * Math.sin(yaw),
  z: -l.x * Math.sin(yaw) + l.z * Math.cos(yaw),
})

test('after the turn the tool direction points at p, for any start yaw and direction', () => {
  const pivot = { x: 1, z: -2 }
  const p = { x: 4, z: 3 }
  const want = Math.atan2(pivot.z - p.z, p.x - pivot.x)
  for (const l of [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
  ]) {
    for (let yaw = -3; yaw < 3.2; yaw += 0.8) {
      const d = aimTurn(yaw, l, pivot, p)
      const v = dirOf(yaw + d, l)
      near(wrap(Math.atan2(-v.z, v.x) - want), 0)
    }
  }
})

test('already aimed: no turn', () => {
  near(aimTurn(0, { x: 1, z: 0 }, { x: 0, z: 0 }, { x: 5, z: 0 }), 0)
})

test('turn is the shortest way', () => {
  const d = aimTurn(0, { x: 1, z: 0 }, { x: 0, z: 0 }, { x: 0, z: -3 })
  near(d, Math.PI / 2)
})

// Range tool following a locked piece: the tool placed as snapPlacement gives, then turned by followPose
const R1_BASE = { c: { x: 2, z: 1 }, radius: 0.6 }
const snapped = (rangeOne, tip) => {
  const r = snapPlacement(
    { x: 0, z: 0, yaw: 0.3 },
    { right: 0, left: 0 },
    R1_BASE.c,
    R1_BASE.radius,
    {
      angle: false,
      rangeOne,
      bendable: false,
      tip,
      halfWidth: 0.5,
      open: null,
    },
  )
  return { pose: { x: r.x, z: r.z, yaw: r.yaw }, snap: r }
}
const PIECES = [
  { x: 5, z: 1 },
  { x: -1, z: 3 },
  { x: 2.5, z: -4 },
  { x: 1, z: 1.4 },
]

test('R1 follows a piece: the width points at it and the tool still touches the snapped base', () => {
  const { pose, snap } = snapped(true, 1.5)
  for (const p of PIECES) {
    const placed = followPose(pose, aimDir(snap, true), R1_BASE.c, p)
    const shape = toolShape(placed, { right: 0, left: 0 })
    // Along the tool's width (local Z) the tool points at p from the base center
    const w = aimDir(snap, true)
    const v = dirOf(placed.yaw, w)
    const want = { x: p.x - R1_BASE.c.x, z: p.z - R1_BASE.c.z }
    const len = Math.hypot(want.x, want.z)
    near(v.x, want.x / len)
    near(v.z, want.z / len)
    assert.ok(touches(shape, 1.5, 0.5, R1_BASE.c, R1_BASE.radius))
    near(footprintGap(shape, 1.5, 0.5, R1_BASE.c, R1_BASE.radius), 0)
  }
})

test('range tool follows a piece: aimed at it, and the cut piece base touches the outline', () => {
  const tip = 4
  const { pose, snap } = snapped(false, tip)
  const radius = 0.7
  for (const p of PIECES) {
    const placed = followPose(pose, aimDir(snap, false), R1_BASE.c, p)
    const shape = toolShape(placed, { right: 0, left: 0 })
    assert.ok(touches(shape, tip, 0.5, R1_BASE.c, R1_BASE.radius))
    const spot = placeClamp(shape, tip, 0.5, p, radius)
    assert.ok(touches(shape, tip, 0.5, spot, radius))
    // The tool (two halves of length tip) points at p: the point at full reach on the line toward p also touches it
    const far = {
      x: R1_BASE.c.x + (p.x - R1_BASE.c.x) * 9,
      z: R1_BASE.c.z + (p.z - R1_BASE.c.z) * 9,
    }
    const cut = placeClamp(shape, tip, 0.5, far, radius)
    const along =
      (cut.x - R1_BASE.c.x) * (p.x - R1_BASE.c.x) + (cut.z - R1_BASE.c.z) * (p.z - R1_BASE.c.z)
    assert.ok(along > 0)
    near(Math.hypot(cut.x - R1_BASE.c.x, cut.z - R1_BASE.c.z), R1_BASE.radius + 2 * tip + radius)
  }
})

test('a piece on the base center does not turn the tool', () => {
  const { pose, snap } = snapped(false, 4)
  assert.equal(followPose(pose, aimDir(snap, false), R1_BASE.c, R1_BASE.c), pose)
})
