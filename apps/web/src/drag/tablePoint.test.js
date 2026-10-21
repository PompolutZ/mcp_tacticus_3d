import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PerspectiveCamera, Vector3 } from 'three'
import { tablePoint } from './tablePoint.js'

const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) }

function camera() {
  const c = new PerspectiveCamera(50, 800 / 600, 0.1, 1000)
  c.position.set(6, 14, 18)
  c.lookAt(0, 0, 0)
  c.updateMatrixWorld(true)
  return c
}

function screenOf(cam, point) {
  const v = point.clone().project(cam)
  return [((v.x + 1) / 2) * 800, ((1 - v.y) / 2) * 600]
}

test('planeY: the point under the pointer is on the plane, at any height', () => {
  const cam = camera()
  const scene = { camera: cam, canvas }
  for (const y of [0, 2.5, -1]) {
    const target = new Vector3(3, y, -2)
    const [x, sy] = screenOf(cam, target)
    const p = tablePoint(scene, x, sy, { planeY: y })
    assert.ok(p.distanceTo(target) < 1e-6)
  }
})

test('planeY: a move of the pointer moves the grabbed point with it, so it stays under the pointer', () => {
  const cam = camera()
  const scene = { camera: cam, canvas }
  const grab = new Vector3(1, 3, 1)
  const [x0, y0] = screenOf(cam, grab)
  const start = tablePoint(scene, x0, y0, { planeY: grab.y })
  const goal = new Vector3(-2, grab.y, 4)
  const [x1, y1] = screenOf(cam, goal)
  const now = tablePoint(scene, x1, y1, { planeY: grab.y })
  const moved = grab.clone().add(now.sub(start))
  // The grabbed point after the move projects to the pointer
  const [px, py] = screenOf(cam, moved)
  assert.ok(Math.hypot(px - x1, py - y1) < 1e-6)
})

test('planeY: a ray that does not meet the plane gives null', () => {
  const cam = camera()
  // Above the horizon, looking up from under a plane that is behind the camera
  const p = tablePoint({ camera: cam, canvas }, 400, 0, { planeY: 100 })
  assert.equal(p, null)
})
