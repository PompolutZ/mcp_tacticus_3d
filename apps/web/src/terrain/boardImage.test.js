import test from 'node:test'
import assert from 'node:assert/strict'
import { flipRows, hideOthers } from './boardImage.js'

test('flipRows puts the last row first and keeps the pixels of a row in order', () => {
  // 2 x 3 image, 4 bytes per pixel: each row has its own value
  const rows = [1, 2, 3].map((v) => Array.from({ length: 8 }, () => v))
  rows[1][0] = 9
  const out = flipRows(Uint8Array.from(rows.flat()), 2, 3)
  assert.deepEqual([...out], [...rows[2], ...rows[1], ...rows[0]])
})

function node(name, children = [], extra = {}) {
  const n = { name, children, visible: true, parent: null, ...extra }
  for (const c of children) c.parent = n
  return n
}

test('hideOthers keeps the mat group, its parents and the lights, and shows the rest again', () => {
  const keep = node('mat')
  const model = node('model')
  const light = node('light', [], { isLight: true })
  const hiddenAlready = node('off', [], { visible: false })
  const physics = node('physics', [keep, model, light])
  const tray = node('tray')
  const scene = node('scene', [physics, tray, light, hiddenAlready])
  light.parent = scene
  const show = hideOthers(scene, keep)
  assert.deepEqual(
    [physics, keep, light, model, tray, hiddenAlready].map((n) => n.visible),
    [true, true, true, false, false, false],
  )
  show()
  assert.deepEqual(
    [physics, keep, light, model, tray, hiddenAlready].map((n) => n.visible),
    [true, true, true, true, true, false],
  )
})
