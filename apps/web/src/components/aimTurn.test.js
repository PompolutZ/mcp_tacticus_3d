import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aimTurn } from './aimTurn.js'

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
