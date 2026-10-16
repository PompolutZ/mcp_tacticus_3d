import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import {
  countRender,
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
