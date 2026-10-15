import { test } from 'node:test'
import assert from 'node:assert/strict'
import { flipTool } from './toolFlip.js'

const shape = (pose, turn) => ({
  right: pose.yaw + turn.right,
  left: pose.yaw + turn.left + Math.PI,
})
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))

test('flipTool: new right half takes the old left direction and the reverse', () => {
  const pose = { x: 1, z: 2, yaw: 0.7 }
  const turn = { right: 0.4, left: -0.9 }
  const f = flipTool(pose, turn)
  const before = shape(pose, turn)
  const after = shape(f.pose, f.turn)
  assert.ok(Math.abs(wrap(after.right - before.left)) < 1e-9)
  assert.ok(Math.abs(wrap(after.left - before.right)) < 1e-9)
  assert.equal(f.pose.x, 1)
  assert.equal(f.pose.z, 2)
})

test('flipTool twice gives the same tool', () => {
  const pose = { x: 0, z: 0, yaw: -1.1 }
  const turn = { right: 0.3, left: 0.5 }
  const f = flipTool(flipTool(pose, turn).pose, flipTool(pose, turn).turn)
  assert.ok(Math.abs(wrap(f.pose.yaw - pose.yaw)) < 1e-9)
  assert.deepEqual(f.turn, turn)
})
