import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_PEEK_SIZE, MIN_PEEK_SIZE } from '../settings/settings.js'
import { peekBox, zoomPeekSize } from './peekSize.js'

const WINDOWS = [
  [1920, 1080],
  [800, 1200],
  [3840, 2160],
]
const ASPECTS = [0.7, 1, 1.4]

test('peek box fits the window and keeps the aspect ratio', () => {
  for (const [windowWidth, windowHeight] of WINDOWS)
    for (const aspect of ASPECTS)
      for (const size of [MIN_PEEK_SIZE, 0.6, MAX_PEEK_SIZE]) {
        const box = peekBox({ windowWidth, windowHeight, aspect, size })
        assert.ok(box.width <= windowWidth && box.height <= windowHeight)
        assert.ok(Math.abs(box.width / box.height - aspect) < 1e-9)
      }
})

test('peek box: a bigger size is never smaller, and a bigger window is never smaller', () => {
  for (const aspect of ASPECTS) {
    let last = 0
    for (const size of [0.3, 0.5, 0.8, 1]) {
      const { width } = peekBox({ windowWidth: 1920, windowHeight: 1080, aspect, size })
      assert.ok(width >= last)
      last = width
    }
    const small = peekBox({ windowWidth: 1000, windowHeight: 700, aspect, size: 0.8 })
    const big = peekBox({ windowWidth: 3000, windowHeight: 2000, aspect, size: 0.8 })
    assert.ok(big.width > small.width)
  }
})

test('peek box at size 1 touches the window on one axis', () => {
  const tall = peekBox({ windowWidth: 1920, windowHeight: 1080, aspect: 0.5, size: 1 })
  assert.ok(tall.height < 1080 && tall.height > 1080 * 0.8)
  const wide = peekBox({ windowWidth: 1000, windowHeight: 2000, aspect: 2, size: 1 })
  assert.ok(wide.width < 1000 && wide.width > 1000 * 0.8)
})

test('zoomPeekSize: up is bigger, down is smaller, always within the range', () => {
  assert.ok(zoomPeekSize(0.6, 0.1) > 0.6)
  assert.ok(zoomPeekSize(0.6, -0.1) < 0.6)
  assert.equal(zoomPeekSize(0.9, 5), MAX_PEEK_SIZE)
  assert.equal(zoomPeekSize(0.9, -50), MIN_PEEK_SIZE)
})
