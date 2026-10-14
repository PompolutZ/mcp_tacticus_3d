import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DRAG_THRESHOLD, cancelActiveDrag, isDragActive, startPointerDrag } from './pointerDrag.js'

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

// A fake ownership: claims that the other owns are refused. lost(key) calls the onLost listeners.
function fakeOwnership(log, { refuse = [] } = {}) {
  const listeners = new Set()
  return {
    claim: (key) => {
      log.push(`claim ${key}`)
      return !refuse.includes(key)
    },
    release: (key) => log.push(`release ${key}`),
    onLost: (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    lost: (key) => listeners.forEach((fn) => fn(key)),
    listenerCount: () => listeners.size,
  }
}

function claimSetup(options = {}, ownershipOptions, eventProps) {
  const log = []
  const ownership = fakeOwnership(log, ownershipOptions)
  const result = setup(
    {
      key: 'tactic:a',
      ownership,
      onStart: () => log.push('start'),
      onMove: () => {
        log.push('move')
      },
      onEnd: () => log.push('end'),
      onClick: () => log.push('click'),
      onCancel: () => log.push('cancel'),
      ...options,
    },
    eventProps,
  )
  return { ...result, log, ownership }
}

test('a drag claims at the first move past the threshold, not at the press', () => {
  const { win, log } = claimSetup()
  assert.deepEqual(log, [])
  win.dispatchEvent(move(100 + DRAG_THRESHOLD))
  assert.deepEqual(log, ['claim tactic:a', 'start', 'move'])
})

test('a click claims nothing', () => {
  const { win, log } = claimSetup()
  win.dispatchEvent(up())
  assert.deepEqual(log, ['click'])
})

test('a refused claim starts no drag', () => {
  const { win, controls, log } = claimSetup({}, { refuse: ['tactic:a'] })
  win.dispatchEvent(move(100 + DRAG_THRESHOLD))
  win.dispatchEvent(move(200))
  win.dispatchEvent(up())
  assert.deepEqual(log, ['claim tactic:a'])
  assert.equal(win.count(), 0)
  assert.equal(controls.enabled, true)
})

test('a refused claim calls onRefused only', () => {
  const refused = []
  const { win, log } = claimSetup(
    { onRefused: () => refused.push('refused') },
    { refuse: ['tactic:a'] },
  )
  win.dispatchEvent(move(200))
  win.dispatchEvent(up())
  assert.deepEqual(log, ['claim tactic:a'])
  assert.deepEqual(refused, ['refused'])
})

test('a refused claim of an immediate drag returns null and starts nothing', () => {
  const { win, controls, log, drag } = claimSetup({ immediate: true }, { refuse: ['tactic:a'] })
  assert.equal(drag, null)
  assert.deepEqual(log, ['claim tactic:a'])
  assert.equal(win.count(), 0)
  assert.equal(controls.enabled, true)
})

test('an immediate drag claims at the press', () => {
  const { log } = claimSetup({ immediate: true })
  assert.deepEqual(log, ['claim tactic:a', 'start'])
})

test('a drop releases after the drop callback', () => {
  const { win, log, ownership } = claimSetup()
  win.dispatchEvent(move(200))
  win.dispatchEvent(up())
  assert.deepEqual(log, ['claim tactic:a', 'start', 'move', 'end', 'release tactic:a'])
  assert.equal(ownership.listenerCount(), 0)
})

test('a drag that onMove ends releases after the drop callback', () => {
  const { win, log } = claimSetup({
    onMove: () => {
      log.push('move')
      return true
    },
  })
  win.dispatchEvent(move(200))
  assert.deepEqual(log, ['claim tactic:a', 'start', 'move', 'end', 'release tactic:a'])
  win.dispatchEvent(up())
  assert.equal(log.filter((l) => l.startsWith('release')).length, 1)
})

test('a cancel releases with no drop', () => {
  const { win, log, drag, ownership } = claimSetup()
  win.dispatchEvent(move(200))
  drag.cancel()
  assert.deepEqual(log, ['claim tactic:a', 'start', 'move', 'cancel', 'release tactic:a'])
  win.dispatchEvent(up())
  assert.equal(log.length, 5)
  assert.equal(ownership.listenerCount(), 0)
})

test('with releaseAtEnd off, a drop and a cancel do not release', () => {
  const dropped = claimSetup({ releaseAtEnd: false })
  dropped.win.dispatchEvent(move(200))
  dropped.win.dispatchEvent(up())
  assert.equal(
    dropped.log.some((l) => l.startsWith('release')),
    false,
  )
  assert.equal(dropped.ownership.listenerCount(), 0)

  const cancelled = claimSetup({ releaseAtEnd: false })
  cancelled.win.dispatchEvent(move(200))
  cancelled.drag.cancel()
  assert.equal(
    cancelled.log.some((l) => l.startsWith('release')),
    false,
  )
  assert.equal(cancelled.ownership.listenerCount(), 0)
})

test('a lost tie for the key cancels the drag', () => {
  const { win, controls, log, ownership } = claimSetup()
  win.dispatchEvent(move(200))
  ownership.lost('tactic:a')
  assert.deepEqual(log, ['claim tactic:a', 'start', 'move', 'cancel', 'release tactic:a'])
  assert.equal(win.count(), 0)
  assert.equal(controls.enabled, true)
  win.dispatchEvent(up())
  assert.equal(log.includes('end'), false)
})

test('a lost tie of another key does nothing', () => {
  const { win, log, ownership } = claimSetup()
  win.dispatchEvent(move(200))
  ownership.lost('tactic:b')
  win.dispatchEvent(up())
  assert.deepEqual(log, ['claim tactic:a', 'start', 'move', 'end', 'release tactic:a'])
})

test('a lost tie of an immediate drag cancels it', () => {
  const { win, log, ownership } = claimSetup({ immediate: true })
  ownership.lost('tactic:a')
  assert.deepEqual(log, ['claim tactic:a', 'start', 'cancel', 'release tactic:a'])
  assert.equal(win.count(), 0)
})

test('without a key or without ownership, nothing is claimed', () => {
  const noKey = claimSetup({ key: null })
  noKey.win.dispatchEvent(move(200))
  noKey.win.dispatchEvent(up())
  assert.deepEqual(noKey.log, ['start', 'move', 'end'])

  const noOwnership = claimSetup({ ownership: null })
  noOwnership.win.dispatchEvent(move(200))
  noOwnership.win.dispatchEvent(up())
  assert.deepEqual(noOwnership.log, ['start', 'move', 'end'])
})

test('the live getter is registered from the claim to the drop', () => {
  const live = new Map()
  const livePose = () => ({ x: 1, z: 2 })
  const { win } = claimSetup({ live, livePose })
  assert.equal(live.size, 0)
  win.dispatchEvent(move(200))
  assert.equal(live.get('tactic:a'), livePose)
  win.dispatchEvent(up())
  assert.equal(live.size, 0)
})

test('the live getter goes at a cancel, and a refused claim registers none', () => {
  const live = new Map()
  const livePose = () => null
  const a = claimSetup({ live, livePose, immediate: true })
  assert.equal(live.get('tactic:a'), livePose)
  a.drag.cancel()
  assert.equal(live.size, 0)
  const b = claimSetup({ live, livePose }, { refuse: ['tactic:a'] })
  b.win.dispatchEvent(move(200))
  assert.equal(live.size, 0)
})

test('preventDefault runs on a HUD DOM event, not on a canvas or R3F event', () => {
  const calls = []
  const props = (extra) => ({ preventDefault: () => calls.push('prevent'), ...extra })
  setup({ preventDefault: true }, props({ target: { tagName: 'DIV' } }))
  assert.deepEqual(calls, ['prevent'])
  setup({ preventDefault: true }, props({ target: { tagName: 'CANVAS' } }))
  setup({ preventDefault: true }, props({ nativeEvent: {}, target: {} }))
  setup({ preventDefault: false }, props({ target: { tagName: 'DIV' } }))
  assert.deepEqual(calls, ['prevent'])
})

test('the active drag: set at the press, cancelActiveDrag cancels it, cleared at the end', () => {
  cancelActiveDrag() // a drag that an earlier test left open
  assert.equal(isDragActive(), false)
  const a = setup()
  assert.equal(isDragActive(), true)
  a.win.dispatchEvent(move(200))
  assert.equal(cancelActiveDrag(), true)
  assert.deepEqual(a.log, ['start', 'move', 'cancel'])
  assert.equal(isDragActive(), false)
  assert.equal(cancelActiveDrag(), false)
  const b = setup()
  b.win.dispatchEvent(move(200))
  b.win.dispatchEvent(up())
  assert.equal(isDragActive(), false)
  assert.equal(cancelActiveDrag(), false)
})

test('onCancel gets the reason: cancel for Esc, lost for a lost tie', () => {
  const reasons = []
  const first = setup({ onCancel: (r) => reasons.push(r) })
  first.win.dispatchEvent(move(200))
  cancelActiveDrag()
  const { win, ownership } = claimSetup({ onCancel: (r) => reasons.push(r) })
  win.dispatchEvent(move(200))
  ownership.lost('tactic:a')
  assert.deepEqual(reasons, ['cancel', 'lost'])
})
