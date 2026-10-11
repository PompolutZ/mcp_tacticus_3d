import { test } from 'node:test'
import assert from 'node:assert/strict'
import { characterOnBoard } from './models.js'

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
