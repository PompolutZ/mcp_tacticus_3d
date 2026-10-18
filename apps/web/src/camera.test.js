import test from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import { MOUSE } from 'three'
import {
  CAMERA_MOUSE_BUTTONS,
  cameraMouseButtons,
  easeInOut,
  framePart,
  panToPoint,
  resetView,
  startView,
  stepVelocity,
  zoomAround,
} from './camera.js'

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

test('startView gives the same object for the same seat', () => {
  assert.equal(startView(false), startView(false))
  assert.equal(startView(true), startView(true))
  assert.notEqual(startView(false), startView(true))
})

test('the Red view is the Blue view turned 180° around the mat center', () => {
  const blue = startView(false)
  const red = startView(true)
  assert.deepEqual(blue.target, [0, 0, 16.8])
  assert.deepEqual(blue.position, [0, 32.5, 49.3])
  assert.deepEqual(red.target, [0, 0, -16.8])
  assert.deepEqual(red.position, [0, 32.5, -49.3])
})

test('the camera mouse buttons turn, pan and turn', () => {
  assert.deepEqual(CAMERA_MOUSE_BUTTONS, {
    LEFT: MOUSE.ROTATE,
    MIDDLE: MOUSE.PAN,
    RIGHT: MOUSE.ROTATE,
  })
})

test('left drag camera on keeps the buttons, off takes only the left one', () => {
  assert.equal(cameraMouseButtons(true), CAMERA_MOUSE_BUTTONS)
  assert.equal(cameraMouseButtons(), CAMERA_MOUSE_BUTTONS)
  const off = cameraMouseButtons(false)
  assert.equal(off.LEFT, null)
  assert.equal(off.MIDDLE, MOUSE.PAN)
  assert.equal(off.RIGHT, MOUSE.ROTATE)
  assert.equal(cameraMouseButtons(false), off)
})

function fakeControls() {
  const calls = []
  return {
    calls,
    object: { position: new Vector3(1, 2, 3) },
    target: new Vector3(4, 5, 6),
    update: () => calls.push('update'),
  }
}

test('resetView stops the wheel, sets the position and the target and updates', () => {
  const controls = fakeControls()
  const order = []
  controls.update = () => order.push('update')
  const wheel = { stop: () => order.push('stop') }
  resetView(controls, wheel, startView(true))
  assert.deepEqual(order, ['stop', 'update'])
  assert.deepEqual(controls.object.position.toArray(), [0, 32.5, -49.3])
  assert.deepEqual(controls.target.toArray(), [0, 0, -16.8])
})

test('resetView works with no wheel camera', () => {
  const controls = fakeControls()
  resetView(controls, null, startView(false))
  assert.deepEqual(controls.object.position.toArray(), [0, 32.5, 49.3])
  assert.deepEqual(controls.calls, ['update'])
})

test('resetView does nothing with no controls, and does not stop the wheel', () => {
  let stopped = false
  resetView(null, { stop: () => (stopped = true) }, startView(false))
  assert.equal(stopped, false)
})

test('framePart is 0 at dt 0 and grows toward 1', () => {
  assert.equal(framePart(0.15, 0), 0)
  assert.ok(Math.abs(framePart(0.15, 0.15) - (1 - Math.exp(-1))) < 1e-12)
  assert.ok(framePart(0.15, 10) > 0.999)
})

test('stepVelocity eases toward the target and does not overshoot', () => {
  const v = stepVelocity(0, 1, 1 / 60, 0.15)
  assert.ok(v > 0 && v < 1)
  assert.ok(stepVelocity(v, 1, 1 / 60, 0.15) > v)
})

test('stepVelocity gives the same speed at 30 and 60 fps', () => {
  let a = 0
  let b = 0
  for (let i = 0; i < 30; i++) a = stepVelocity(a, 1, 1 / 60, 0.15)
  for (let i = 0; i < 15; i++) b = stepVelocity(b, 1, 1 / 30, 0.15)
  assert.ok(Math.abs(a - b) < 1e-9)
})

test('stepVelocity glides to 0 and snaps to 0', () => {
  let v = 1
  let frames = 0
  while (v !== 0 && frames < 1000) {
    v = stepVelocity(v, 0, 1 / 60, 0.15)
    frames++
  }
  assert.equal(v, 0)
  assert.ok(frames > 10 && frames < 100)
})

test('matrixChanged is true for the first call and for a change, false for the same numbers', async () => {
  const { matrixChanged } = await import('./camera.js')
  const saved = []
  assert.equal(matrixChanged(saved, [1, 2, 3]), true)
  assert.equal(matrixChanged(saved, [1, 2, 3]), false)
  assert.equal(matrixChanged(saved, [1, 2, 4]), true)
  assert.equal(matrixChanged(saved, [1, 2, 4]), false)
})

test('zoomAround scales camera and target offsets from the point and keeps the target height', () => {
  const camera = { position: new Vector3(3, 20, 14) }
  const target = new Vector3(2, 0, 1)
  const point = new Vector3(6, 0, -4)
  const cam0 = camera.position.clone().sub(point)
  const tar0 = target.clone().sub(point)
  zoomAround(camera, target, point, 0.5)
  assert.ok(camera.position.clone().sub(point).distanceTo(cam0.multiplyScalar(0.5)) < 1e-9)
  assert.ok(target.clone().sub(point).distanceTo(tar0.multiplyScalar(0.5)) < 1e-9)
  assert.equal(target.y, 0)
})
