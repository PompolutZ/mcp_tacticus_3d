import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { loopCopies, shortWay, slideInFan, targetPosition } from './carouselLoop.js'

const COUNTS = [2, 3, 4, 5, 6, 7, 10, 25]

describe('fan carousel loop', () => {
  it('only a fan with 2 or more cards repeats the cards, in whole decks', () => {
    assert.equal(loopCopies(5, false), 1)
    assert.equal(loopCopies(1, true), 1)
    for (const count of COUNTS) assert.ok(loopCopies(count, true) >= 1)
  })

  it('shows each card at most once, the shown card in the middle, at any position', () => {
    for (const count of COUNTS) {
      const total = count * loopCopies(count, true)
      for (let sel = 0; sel < total; sel++) {
        const seen = new Map()
        for (let pos = 0; pos < total; pos++) {
          const s = slideInFan(pos, sel, count, total)
          if (!s.visible) continue
          const card = pos % count
          assert.equal(seen.has(card), false)
          seen.set(card, s.offset)
        }
        assert.equal(seen.size, count)
        assert.equal(seen.get(sel % count), 0)
      }
    }
  })

  it('puts the cards on both sides the short way, evenly', () => {
    for (const count of [3, 5, 7]) {
      const total = count * loopCopies(count, true)
      const sel = 0
      const offsets = []
      for (let pos = 0; pos < total; pos++) {
        const s = slideInFan(pos, sel, count, total)
        if (s.visible) offsets.push(s.offset)
      }
      const neg = offsets.filter((o) => o < 0).length
      const pos = offsets.filter((o) => o > 0).length
      assert.equal(neg, pos)
    }
  })

  it('scrolls to the nearest copy of a card, the short way', () => {
    for (const count of COUNTS) {
      const total = count * loopCopies(count, true)
      for (let from = 0; from < total; from++) {
        for (let card = 0; card < count; card++) {
          const to = targetPosition(from, card, count, total)
          assert.equal(to % count, card)
          assert.ok(Math.abs(shortWay(to - from, total)) <= count / 2)
        }
      }
    }
  })
})
