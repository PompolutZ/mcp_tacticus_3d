import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DRAG_THRESHOLD, startPointerDrag } from './pointerDrag.js'

// EventTarget that counts its listeners
function fakeWindow() {
  const target = new EventTarget()
  const listeners = new Set()
  const add = target.addEventListener.bind(target)
  const remove = target.removeEventListener.bind(target)
  target.addEventListener = (type, fn) => {
    listeners.add(`${type}:${fn.name}`)
    add(type, fn)
  }
  target.removeEventListener = (type, fn) => {
    listeners.delete(`${type}:${fn.name}`)
    remove(type, fn)
  }
  target.count = () => listeners.size
  return target
}

function pointer(type, props) {
  return Object.assign(new Event(type), { pointerId: 1, clientX: 0, clientY: 0, ...props })
}

function press(props) {
  return { button: 0, pointerId: 1, clientX: 100, clientY: 100, stopPropagation() {}, ...props }
}

// Starts a drag that logs its callbacks
function setup(options = {}, eventProps) {
  const win = fakeWindow()
  const controls = { enabled: true }
  const log = []
  const drag = startPointerDrag(press(eventProps), {
    window: win,
    controls,
    onStart: () => log.push('start'),
    onMove: () => {
      log.push('move')
    },
    onEnd: () => log.push('end'),
    onClick: () => log.push('click'),
    onCancel: () => log.push('cancel'),
    ...options,
  })
  return { win, controls, log, drag }
}

const move = (x, y = 100, props) => pointer('pointermove', { clientX: x, clientY: y, ...props })
const up = (props) => pointer('pointerup', props)

test('a move below the threshold and a release is a click', () => {
  const { win, log } = setup()
  win.dispatchEvent(move(100 + DRAG_THRESHOLD - 1))
  win.dispatchEvent(up())
  assert.deepEqual(log, ['click'])
})

test('a move past the threshold starts the drag once', () => {
  const { win, log } = setup()
  win.dispatchEvent(move(100 + DRAG_THRESHOLD))
  win.dispatchEvent(move(120))
  win.dispatchEvent(up())
  assert.deepEqual(log, ['start', 'move', 'move', 'end'])
})

test('another pointer id is ignored', () => {
  const { win, log } = setup()
  win.dispatchEvent(move(200, 100, { pointerId: 2 }))
  win.dispatchEvent(up({ pointerId: 2 }))
  assert.deepEqual(log, [])
  assert.equal(win.count(), 2)
})

test('another button does not start', () => {
  const { win, controls, log, drag } = setup({}, { button: 2 })
  assert.equal(drag, null)
  assert.equal(win.count(), 0)
  assert.equal(controls.enabled, true)
  win.dispatchEvent(move(200))
  assert.deepEqual(log, [])
})

test('the controls are off during the press and on after it', () => {
  const { win, controls } = setup()
  assert.equal(controls.enabled, false)
  win.dispatchEvent(move(200))
  assert.equal(controls.enabled, false)
  win.dispatchEvent(up())
  assert.equal(controls.enabled, true)
})

test('cancel() ends the drag with no drop', () => {
  const { win, controls, log, drag } = setup()
  win.dispatchEvent(move(200))
  drag.cancel()
  win.dispatchEvent(move(300))
  win.dispatchEvent(up())
  assert.deepEqual(log, ['start', 'move', 'cancel'])
  assert.equal(controls.enabled, true)
  drag.cancel()
  assert.deepEqual(log, ['start', 'move', 'cancel'])
})

test('the listeners are removed after the release and after cancel()', () => {
  const a = setup()
  assert.equal(a.win.count(), 2)
  a.win.dispatchEvent(move(200))
  a.win.dispatchEvent(up())
  assert.equal(a.win.count(), 0)

  const b = setup()
  b.drag.cancel()
  assert.equal(b.win.count(), 0)
})

test('canStart can hold a drag back until it says yes', () => {
  let ok = false
  const { win, log } = setup({ canStart: () => ok })
  win.dispatchEvent(move(200))
  assert.deepEqual(log, [])
  ok = true
  win.dispatchEvent(move(210))
  win.dispatchEvent(up())
  assert.deepEqual(log, ['start', 'move', 'end'])
})

test('a refused canStart of an immediate press starts nothing', () => {
  const { win, controls, drag } = setup({ immediate: true, canStart: () => false })
  assert.equal(drag, null)
  assert.equal(win.count(), 0)
  assert.equal(controls.enabled, true)
})

test('an immediate press is a drag with no click', () => {
  const { win, log } = setup({ immediate: true })
  assert.deepEqual(log, ['start'])
  win.dispatchEvent(move(101))
  win.dispatchEvent(up())
  assert.deepEqual(log, ['start', 'move', 'end'])
})

test('onMove can end the drag: the release does nothing more', () => {
  const { win, controls, log } = setup({
    onMove: () => {
      log.push('move')
      return true
    },
  })
  win.dispatchEvent(move(200))
  win.dispatchEvent(move(210))
  assert.equal(controls.enabled, false)
  win.dispatchEvent(up())
  assert.deepEqual(log, ['start', 'move', 'end'])
  assert.equal(controls.enabled, true)
  assert.equal(win.count(), 0)
})

test('the pointer capture of the canvas is released', () => {
  const released = []
  const canvas = {
    hasPointerCapture: (id) => id === 1,
    releasePointerCapture: (id) => released.push(id),
  }
  setup({ canvas })
  setup({ canvas, releaseCapture: false })
  assert.deepEqual(released, [1])
})
