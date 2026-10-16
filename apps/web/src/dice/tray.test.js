import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FACE_PLATES,
  KEYS_LIP,
  TRAYS,
  TRAY_HOVER_MARGIN,
  TRAY_OUTLINE,
  overTray,
  trayToWorld,
} from './tray.js'

const keys = Object.keys(TRAYS)
const at = (trayKey, x, z) => overTray(trayKey, trayToWorld(trayKey, { x, y: 0, z }))
const mid = (a, b) => (a + b) / 2
const o = TRAY_OUTLINE

test('overTray: inside the outline, on each tray, whatever its yaw', () => {
  for (const key of keys) {
    assert.ok(at(key, mid(o.xMin, o.xMax), mid(o.zMin, o.zMax)))
    assert.ok(at(key, o.xMin + 0.01, o.zMin + 0.01))
    assert.ok(at(key, o.xMax - 0.01, o.zMax - 0.01))
  }
})

test('overTray: the keys lip and the rim plates are inside', () => {
  for (const key of keys) {
    assert.ok(at(key, 0, KEYS_LIP.low.z))
    assert.ok(at(key, 0, KEYS_LIP.high.z))
    for (const x of Object.values(FACE_PLATES.x)) {
      assert.ok(at(key, x, FACE_PLATES.z - FACE_PLATES.depth / 2))
      assert.ok(at(key, x, FACE_PLATES.z + FACE_PLATES.depth / 2))
    }
  }
})

test('overTray: a point within the margin outside each side counts', () => {
  const m = TRAY_HOVER_MARGIN
  const eps = 0.01
  for (const key of keys) {
    assert.ok(at(key, o.xMin - eps, 0))
    assert.ok(at(key, o.xMax + eps, 0))
    assert.ok(at(key, 0, o.zMin - eps))
    assert.ok(at(key, 0, o.zMax + eps))
    assert.ok(at(key, o.xMin - m + eps, 0))
    assert.ok(at(key, o.xMax + m - eps, 0))
    assert.ok(at(key, 0, o.zMin - m + eps))
    assert.ok(at(key, 0, o.zMax + m - eps))
    assert.ok(at(key, o.xMax + m - eps, o.zMax + m - eps))
  }
})

test('overTray: a point just past the margin on each side is out', () => {
  const m = TRAY_HOVER_MARGIN
  const eps = 0.01
  for (const key of keys) {
    assert.ok(!at(key, o.xMin - m - eps, 0))
    assert.ok(!at(key, o.xMax + m + eps, 0))
    assert.ok(!at(key, 0, o.zMin - m - eps))
    assert.ok(!at(key, 0, o.zMax + m + eps))
  }
})

test('overTray: a point of one tray is not over the other tray', () => {
  const [a, b] = keys
  const center = trayToWorld(a, { x: 0, y: 0, z: mid(o.zMin, o.zMax) })
  assert.ok(overTray(a, center))
  assert.ok(!overTray(b, center))
})

test('overTray: height does not matter', () => {
  const p = trayToWorld(keys[0], { x: 0, y: 5, z: 0 })
  assert.ok(overTray(keys[0], p))
})
