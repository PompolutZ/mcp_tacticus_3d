import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_BRIGHTNESS,
  MIN_BRIGHTNESS,
  VERSION,
  defaultSettings,
  readSettings,
  writeSettings,
} from './settings.js'

const KEY = 'mcp-assist-3d/settings'

// A fake localStorage; `fail` makes every call throw
function fakeStorage(fail = false) {
  const data = new Map()
  const check = () => {
    if (fail) throw new Error('storage off')
  }
  return {
    getItem(key) {
      check()
      return data.has(key) ? data.get(key) : null
    },
    setItem(key, value) {
      check()
      data.set(key, String(value))
    },
  }
}

function withStorage(storage, fn) {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
  try {
    fn()
  } finally {
    if (saved) Object.defineProperty(globalThis, 'localStorage', saved)
    else delete globalThis.localStorage
  }
}

test('nothing stored: power and cleanup are in the HUD, the rest on the table', () => {
  withStorage(fakeStorage(), () => {
    const settings = readSettings()
    assert.deepEqual(settings, defaultSettings())
    assert.deepEqual(settings.tools, {
      rack: 'table',
      power: 'hud',
      cleanup: 'hud',
      deployLock: 'table',
      matTurn: 'table',
    })
    assert.equal(settings.version, VERSION)
    assert.deepEqual(Object.keys(settings.tools), [
      'rack',
      'power',
      'cleanup',
      'deployLock',
      'matTurn',
    ])
  })
})

test('a written setting reads back', () => {
  withStorage(fakeStorage(), () => {
    const settings = defaultSettings()
    settings.tools.power = 'table'
    settings.tools.rack = 'hud'
    assert.equal(writeSettings(settings), true)
    assert.equal(readSettings().tools.power, 'table')
    assert.equal(readSettings().tools.rack, 'hud')
    assert.equal(readSettings().tools.cleanup, 'hud')
    assert.equal(readSettings().tools.deployLock, 'table')
  })
})

test('a missing or unknown value is the default, other values stay', () => {
  const storage = fakeStorage()
  storage.setItem(
    KEY,
    JSON.stringify({
      version: VERSION,
      tools: { rack: 'hud', power: 'left', cleanup: 3, matTurn: 'hud' },
    }),
  )
  withStorage(storage, () => {
    const { tools } = readSettings()
    assert.equal(tools.rack, 'hud')
    assert.equal(tools.power, 'hud')
    assert.equal(tools.cleanup, 'hud')
    assert.equal(tools.deployLock, 'table')
    assert.equal(tools.matTurn, 'hud')
  })
})

test('saved without a version: power and cleanup go to the HUD once, then the saved value stays', () => {
  const storage = fakeStorage()
  storage.setItem(KEY, JSON.stringify({ tools: { rack: 'hud', power: 'table', cleanup: 'table' } }))
  withStorage(storage, () => {
    const { tools } = readSettings()
    assert.equal(tools.power, 'hud')
    assert.equal(tools.cleanup, 'hud')
    assert.equal(tools.rack, 'hud')
    const settings = readSettings()
    settings.tools.power = 'table'
    assert.equal(writeSettings(settings), true)
    assert.equal(readSettings().version, VERSION)
    assert.equal(readSettings().tools.power, 'table')
    assert.equal(readSettings().tools.cleanup, 'hud')
  })
})

test('stored text that is not JSON gives the defaults', () => {
  const storage = fakeStorage()
  storage.setItem(KEY, '{nope')
  withStorage(storage, () => assert.deepEqual(readSettings(), defaultSettings()))
})

test('storage that throws: defaults on read, false on write', () => {
  withStorage(fakeStorage(true), () => {
    assert.deepEqual(readSettings(), defaultSettings())
    assert.equal(writeSettings(defaultSettings()), false)
  })
})

test('the volume is 10 by default, is kept, and stays from 0 to 100', () => {
  assert.equal(defaultSettings().sound.volume, 10)
  const read = (sound) => {
    const storage = fakeStorage()
    storage.setItem(KEY, JSON.stringify({ sound }))
    let volume
    withStorage(storage, () => (volume = readSettings().sound.volume))
    return volume
  }
  assert.equal(read({ volume: 0 }), 0)
  assert.equal(read({ volume: 35 }), 35)
  assert.equal(read({ volume: 250 }), 100)
  assert.equal(read({ volume: -4 }), 0)
  assert.equal(read({ volume: 'loud' }), 10)
  assert.equal(read(null), 10)
})

test('bindings: nothing stored means no changed action', () => {
  assert.deepEqual(defaultSettings().bindings, {})
  withStorage(fakeStorage(), () => assert.deepEqual(readSettings().bindings, {}))
})

const bnd = (code, when = 'anywhere', extra = {}) => ({
  code,
  shift: false,
  ctrl: false,
  alt: false,
  meta: false,
  when,
  ...extra,
})

test('bindings: a changed action is stored and reads back, a default one is not stored', () => {
  withStorage(fakeStorage(), () => {
    const settings = defaultSettings()
    settings.bindings = {
      flip: [bnd('KeyG', 'anywhere', { shift: true })],
      lift: [bnd('KeyR')],
      ping: [],
    }
    assert.equal(writeSettings(settings), true)
    assert.deepEqual(readSettings().bindings, {
      flip: [bnd('KeyG', 'anywhere', { shift: true })],
      ping: [],
    })
  })
})

test('bindings: unknown actions, codes and conditions are dropped', () => {
  const storage = fakeStorage()
  storage.setItem(
    KEY,
    JSON.stringify({
      bindings: {
        nope: [bnd('KeyA')],
        flip: [bnd('KeyG'), bnd('NotACode'), bnd('KeyH', 'popup'), bnd('KeyJ', 'sometimes'), null],
        lock: [bnd('Nope')],
        dice3: [bnd('KeyT', 'anywhere')],
        cardNext: 'x',
      },
    }),
  )
  withStorage(storage, () => {
    assert.deepEqual(readSettings().bindings, { flip: [bnd('KeyG')] })
  })
})

test('bindings: stored modifiers that are not true are false', () => {
  const storage = fakeStorage()
  storage.setItem(
    KEY,
    JSON.stringify({
      bindings: { flip: [{ code: 'KeyG', shift: 1, ctrl: true, when: 'anywhere' }] },
    }),
  )
  withStorage(storage, () =>
    assert.deepEqual(readSettings().bindings.flip, [bnd('KeyG', 'anywhere', { ctrl: true })]),
  )
})

test('labels: off by default, only true turns them on', () => {
  assert.equal(defaultSettings().labels, false)
  const read = (labels) => {
    const storage = fakeStorage()
    storage.setItem(KEY, JSON.stringify({ version: VERSION, labels }))
    let value
    withStorage(storage, () => {
      value = readSettings().labels
    })
    return value
  }
  assert.equal(read(true), true)
  assert.equal(read(false), false)
  assert.equal(read('yes'), false)
  assert.equal(read(1), false)
  assert.equal(read(undefined), false)
})

test('leftDragCamera: on by default, only false turns it off', () => {
  assert.equal(defaultSettings().leftDragCamera, true)
  const read = (leftDragCamera) => {
    const storage = fakeStorage()
    storage.setItem(KEY, JSON.stringify({ version: VERSION, leftDragCamera }))
    let value
    withStorage(storage, () => {
      value = readSettings().leftDragCamera
    })
    return value
  }
  assert.equal(read(false), false)
  assert.equal(read(true), true)
  assert.equal(read('no'), true)
  assert.equal(read(0), true)
  assert.equal(read(undefined), true)
})

test('performance.composer: on by default, only false turns it off', () => {
  assert.equal(defaultSettings().performance.composer, true)
  const read = (performance) => {
    const storage = fakeStorage()
    storage.setItem(KEY, JSON.stringify({ version: VERSION, performance }))
    let value
    withStorage(storage, () => {
      value = readSettings().performance.composer
    })
    return value
  }
  assert.equal(read({ composer: false }), false)
  assert.equal(read({ composer: true }), true)
  assert.equal(read({ composer: 'no' }), true)
  assert.equal(read({ composer: 0 }), true)
  assert.equal(read({}), true)
  assert.equal(read('off'), true)
  assert.equal(read(undefined), true)
})

test('rethrowTilted: off by default, only true turns it on', () => {
  assert.equal(defaultSettings().rethrowTilted, false)
  const read = (rethrowTilted) => {
    const storage = fakeStorage()
    storage.setItem(KEY, JSON.stringify({ version: VERSION, rethrowTilted }))
    let value
    withStorage(storage, () => {
      value = readSettings().rethrowTilted
    })
    return value
  }
  assert.equal(read(true), true)
  assert.equal(read(false), false)
  assert.equal(read('yes'), false)
  assert.equal(read(undefined), false)
})

test('spectator size: default 100, clamped to 60-150, rounded, junk is the default', () => {
  assert.equal(defaultSettings().spectator.size, 100)
  const read = (spectator) => {
    const storage = fakeStorage()
    storage.setItem(KEY, JSON.stringify({ version: VERSION, spectator }))
    let size
    withStorage(storage, () => {
      size = readSettings().spectator.size
    })
    return size
  }
  assert.equal(read({ size: 20 }), 60)
  assert.equal(read({ size: 400 }), 150)
  assert.equal(read({ size: 80.4 }), 80)
  assert.equal(read({ size: 'big' }), 100)
  assert.equal(read(undefined), 100)
})

test('turn step: default 15, clamped to 5-15, rounded, junk is the default', () => {
  assert.equal(defaultSettings().turn.step, 15)
  const read = (turn) => {
    const storage = fakeStorage()
    storage.setItem(KEY, JSON.stringify({ version: VERSION, turn }))
    let step
    withStorage(storage, () => {
      step = readSettings().turn.step
    })
    return step
  }
  assert.equal(read({ step: 1 }), 5)
  assert.equal(read({ step: 40 }), 15)
  assert.equal(read({ step: 7.6 }), 8)
  assert.equal(read({ step: 'big' }), 15)
  assert.equal(read(undefined), 15)
})

test('scene brightness: default 100, clamped into range, rounded, junk is the default', () => {
  const fallback = defaultSettings().light.brightness
  const read = (light) => {
    const storage = fakeStorage()
    storage.setItem(KEY, JSON.stringify({ version: VERSION, light }))
    let brightness
    withStorage(storage, () => {
      brightness = readSettings().light.brightness
    })
    return brightness
  }
  assert.equal(read({ brightness: 1 }), MIN_BRIGHTNESS)
  assert.equal(read({ brightness: 1000 }), MAX_BRIGHTNESS)
  assert.equal(read({ brightness: 80.4 }), 80)
  assert.equal(read({ brightness: 'bright' }), fallback)
  assert.equal(read(undefined), fallback)
})
