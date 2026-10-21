import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Matrix4, Vector3 } from 'three'
import { localDelta } from './localDelta.js'

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`)

test('no parent turn: the local move is the world move', () => {
  const d = localDelta(new Matrix4(), new Vector3(1, 0, 1), new Vector3(4, 0, -2))
  near(d.dx, 3)
  near(d.dz, -3)
})

test('a world move along x, with the parent turned one quarter, is a local move along z', () => {
  const parent = new Matrix4().makeRotationY(Math.PI / 2)
  const d = localDelta(parent, new Vector3(0, 0, 0), new Vector3(5, 0, 0))
  near(d.dx, 0)
  near(d.dz, 5)
})

test('for every mat turn the local move lands under the world pointer', () => {
  for (let turns = 0; turns < 4; turns++) {
    const parent = new Matrix4().makeRotationY((turns * Math.PI) / 2)
    const from = new Vector3(2, 0, -1)
    const to = new Vector3(-3, 0, 4)
    const { dx, dz } = localDelta(parent, from, to)
    const start = from.clone().applyMatrix4(parent.clone().invert())
    const end = new Vector3(start.x + dx, 0, start.z + dz).applyMatrix4(parent)
    near(end.x, to.x)
    near(end.z, to.z)
  }
})
