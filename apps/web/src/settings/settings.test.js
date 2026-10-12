import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultSettings, readSettings, writeSettings } from './settings.js'

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

test('nothing stored: every item is on the table', () => {
  withStorage(fakeStorage(), () => {
    const settings = readSettings()
    assert.deepEqual(settings, defaultSettings())
    assert.ok(Object.values(settings.tools).every((place) => place === 'table'))
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
    settings.tools.power = 'hud'
    assert.equal(writeSettings(settings), true)
    assert.equal(readSettings().tools.power, 'hud')
    assert.equal(readSettings().tools.rack, 'table')
  })
})

test('a missing or unknown value is the default, other values stay', () => {
  const storage = fakeStorage()
  storage.setItem(KEY, JSON.stringify({ tools: { rack: 'hud', power: 'left', cleanup: 3 } }))
  withStorage(storage, () => {
    const { tools } = readSettings()
    assert.equal(tools.rack, 'hud')
    assert.equal(tools.power, 'table')
    assert.equal(tools.cleanup, 'table')
    assert.equal(tools.matTurn, 'table')
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

test('the volume is 60 by default, is kept, and stays from 0 to 100', () => {
  assert.equal(defaultSettings().sound.volume, 60)
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
  assert.equal(read({ volume: 'loud' }), 60)
  assert.equal(read(null), 60)
})
