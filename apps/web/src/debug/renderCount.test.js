import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import {
  changedReasons,
  countReasons,
  countRender,
  readRenderReasons,
  readRenderCounts,
  resetRenderCounts,
  setRenderCounting,
} from './renderCount.js'

beforeEach(() => {
  setRenderCounting(true)
  resetRenderCounts()
})

test('does not count while off', () => {
  setRenderCounting(false)
  countRender('A', 0)
  assert.deepEqual(readRenderCounts(0), [])
})

test('same name adds up, names sorted', () => {
  countRender('B', 0)
  countRender('A', 0)
  countRender('A', 10)
  assert.deepEqual(readRenderCounts(20), [
    { name: 'A', total: 2, lastSecond: 2 },
    { name: 'B', total: 1, lastSecond: 1 },
  ])
})

test('last second drops old commits, total stays', () => {
  countRender('A', 0)
  countRender('A', 900)
  assert.deepEqual(readRenderCounts(1500), [{ name: 'A', total: 2, lastSecond: 1 }])
  assert.deepEqual(readRenderCounts(2500), [{ name: 'A', total: 2, lastSecond: 0 }])
})

test('reset clears', () => {
  countRender('A', 0)
  resetRenderCounts()
  assert.deepEqual(readRenderCounts(0), [])
})

test('changedReasons: mount, changed names, parent', () => {
  const a = {}
  assert.deepEqual(changedReasons(null, { x: 1 }), ['mount'])
  assert.deepEqual(changedReasons({ x: 1, y: a, z: NaN }, { x: 2, y: a, z: NaN }), ['x'])
  assert.deepEqual(changedReasons({ x: 1, y: {} }, { x: 1, y: {} }), ['y'])
  assert.deepEqual(changedReasons({ x: 1 }, { x: 1 }), ['parent'])
})

test('countReasons: sorted by count, reset clears, off counts nothing', () => {
  countReasons('S', ['a', 'b'])
  countReasons('S', ['b'])
  assert.deepEqual(readRenderReasons('S'), [
    { reason: 'b', count: 2 },
    { reason: 'a', count: 1 },
  ])
  assert.deepEqual(readRenderReasons('T'), [])
  resetRenderCounts()
  assert.deepEqual(readRenderReasons('S'), [])
  setRenderCounting(false)
  countReasons('S', ['a'])
  assert.deepEqual(readRenderReasons('S'), [])
})
