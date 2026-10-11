import { test } from 'node:test'
import assert from 'node:assert/strict'
import { characterOnBoard, modelFigureYaw, modelSpawnYaw, yawQuaternion } from './models.js'

const ch = { id: 'c1', key: 'hulk', figure: 'model', base: 'medium', rotation: 0 }
const two = { ...ch, transform: { figure: 'model', card: true } }
const pose = (x, z) => ({ x, y: 0, z, qx: 0, qy: 0, qz: 0, qw: 1 })

test('a pose on the mat is on the board', () => {
  assert.equal(characterOnBoard(ch, { c1: pose(3, -10) }), true)
})

test('the mat edge is on the board', () => {
  assert.equal(characterOnBoard(ch, { c1: pose(18, -18) }), true)
})

test('a pose on the tray, outside the mat, is off the board', () => {
  assert.equal(characterOnBoard(ch, { c1: pose(0, 25) }), false)
  assert.equal(characterOnBoard(ch, { c1: pose(-30, 0) }), false)
})

test('no pose is off the board', () => {
  assert.equal(characterOnBoard(ch, {}), false)
  assert.equal(characterOnBoard(ch, undefined), false)
})

test('only the second model on the mat is on the board', () => {
  const poses = { c1: pose(0, 25), 'c1:2': pose(5, 5) }
  assert.equal(characterOnBoard(two, poses), true)
  assert.equal(characterOnBoard(ch, poses), false)
})

test('blue and red models spawn 180 degrees apart', () => {
  const turn = Math.abs(modelSpawnYaw('red') - modelSpawnYaw('blue'))
  assert.ok(Math.abs(turn - Math.PI) < 1e-9)
})

test('a standee has no model part of the turn', () => {
  assert.equal(modelFigureYaw({ figure: 'standee', rotation: 330 }), 0)
})

test('the model part is the import turn minus cModelRot', () => {
  assert.ok(Math.abs(modelFigureYaw({ figure: 'model', rotation: 180 })) < 1e-9)
  assert.ok(Math.abs(modelFigureYaw({ figure: 'model', rotation: 90 }) - Math.PI / 2) < 1e-9)
  assert.ok(Math.abs(modelFigureYaw({ figure: 'model', rotation: 0 }) - Math.PI) < 1e-9)
})

test('the blue body starts with no turn', () => {
  assert.equal(modelSpawnYaw('blue'), 0)
  const q = yawQuaternion(modelSpawnYaw('red'))
  assert.ok(Math.abs(Math.abs(q.y) - 1) < 1e-9 && Math.abs(q.w) < 1e-9)
})
