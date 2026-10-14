import test from 'node:test'
import assert from 'node:assert/strict'
import { canDropTool, toolArms } from './dropShape.js'
import { MOVE_TIP, RANGE_TIP } from './toolTips.js'
import { rackPlate } from './layout.js'

test('range tool: two arms along x, 1 inch wide; range 1 is the R2 tool', () => {
  const arms = toolArms('range', 4)
  assert.deepEqual(
    arms.map((a) => a.length),
    [RANGE_TIP[4], RANGE_TIP[4]],
  )
  assert.ok(arms.every((a) => a.width === 1))
  assert.deepEqual(
    arms.map((a) => a.angle),
    [0, Math.PI],
  )
  assert.deepEqual(toolArms('range', 1), toolArms('range', 2))
})

test('movement tool: two arms, 0.56 inch wide', () => {
  const arms = toolArms('move', 'medium')
  assert.deepEqual(
    arms.map((a) => a.length),
    [MOVE_TIP.medium, MOVE_TIP.medium],
  )
  assert.ok(arms.every((a) => a.width === 0.56))
})

test('Toward / Away: two long arms at 90 degrees', () => {
  const [a, b] = toolArms('angle', true)
  assert.equal(a.length, MOVE_TIP.long)
  assert.equal(b.length, MOVE_TIP.long)
  assert.ok(Math.abs(b.angle - a.angle - Math.PI / 2) < 1e-9)
})

test('canDropTool: false off the table and over the own rack', () => {
  const plate = rackPlate('host')
  assert.equal(canDropTool('host', null), false)
  assert.equal(canDropTool('host', { x: plate.x, z: plate.z }), false)
})

test('canDropTool: true on the table, also over the other rack', () => {
  assert.equal(canDropTool('host', { x: 0, z: 0 }), true)
  assert.equal(canDropTool('host', { x: rackPlate('guest').x, z: rackPlate('guest').z }), true)
  assert.equal(canDropTool('host', { x: 27, z: 10 }), true)
})

test('Line of Sight: one arm along the tool direction', () => {
  const arms = toolArms('los', true)
  assert.equal(arms.length, 1)
  assert.equal(arms[0].angle, 0)
})
