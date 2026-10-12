import test from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import { easeInOut, panToPoint } from './camera.js'

test('the ease starts at 0, ends at 1 and is half at the middle', () => {
  assert.equal(easeInOut(0), 0)
  assert.equal(easeInOut(1), 1)
  assert.equal(easeInOut(0.5), 0.5)
})

// A clock and a frame queue by hand
function clock() {
  let time = 0
  let queued = null
  return {
    now: () => time,
    raf: (fn) => {
      queued = fn
      return 1
    },
    caf: () => {
      queued = null
    },
    advance(ms) {
      time += ms
      const fn = queued
      queued = null
      fn?.()
    },
  }
}

const controlsAt = () => ({
  object: { position: new Vector3(0, 32, 49) },
  target: new Vector3(0, 0, 17),
  update() {},
})

test('the target goes to the point and the camera keeps its offset', () => {
  const controls = controlsAt()
  const offset = controls.object.position.clone().sub(controls.target)
  const c = clock()
  panToPoint(controls, { x: 10, y: 0, z: -5 }, { ms: 600, ...c })
  c.advance(300)
  assert.ok(controls.target.x > 0 && controls.target.x < 10)
  c.advance(300)
  assert.deepEqual(controls.target.toArray(), [10, 0, -5])
  const now = controls.object.position.clone().sub(controls.target)
  assert.ok(now.distanceTo(offset) < 1e-9)
})

test('the stop function ends the move', () => {
  const controls = controlsAt()
  const c = clock()
  const stop = panToPoint(controls, { x: 10, y: 0, z: 0 }, { ms: 600, ...c })
  c.advance(100)
  const x = controls.target.x
  stop()
  c.advance(600)
  assert.equal(controls.target.x, x)
})
