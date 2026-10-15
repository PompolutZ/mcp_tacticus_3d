import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readJson, readText, removeKey, storageKeys, writeJson, writeText } from './storage.js'

function fakeArea(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    get length() {
      return map.size
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  }
}

const broken = {
  get length() {
    throw new Error('off')
  },
  key: () => {
    throw new Error('off')
  },
  getItem: () => {
    throw new Error('off')
  },
  setItem: () => {
    throw new Error('full')
  },
  removeItem: () => {
    throw new Error('off')
  },
}

test('a missing key reads null', () => {
  const area = fakeArea()
  assert.equal(readText('a', area), null)
  assert.equal(readJson('a', area), null)
})

test('json round trip, and bad json reads null', () => {
  const area = fakeArea({ bad: '{nope' })
  assert.equal(writeJson('a', { x: 1 }, area), true)
  assert.deepEqual(readJson('a', area), { x: 1 })
  assert.equal(readJson('bad', area), null)
})

test('text round trip and remove', () => {
  const area = fakeArea()
  assert.equal(writeText('t', 'abc', area), true)
  assert.equal(readText('t', area), 'abc')
  removeKey('t', area)
  assert.equal(readText('t', area), null)
})

test('a throwing area never throws', () => {
  assert.equal(readText('a', broken), null)
  assert.equal(readJson('a', broken), null)
  assert.equal(writeText('a', 'x', broken), false)
  assert.equal(writeJson('a', 1, broken), false)
  removeKey('a', broken)
  assert.deepEqual(storageKeys('', broken), [])
})

test('the session area name does not throw without sessionStorage', () => {
  assert.equal(readText('a', 'session'), null)
  assert.equal(writeText('a', 'x', 'session'), false)
})

test('storageKeys filters by prefix', () => {
  const area = fakeArea({ 'p/1': 'a', 'p/2': 'b', 'q/1': 'c' })
  assert.deepEqual(storageKeys('p/', area), ['p/1', 'p/2'])
  assert.deepEqual(storageKeys('', area), ['p/1', 'p/2', 'q/1'])
})
