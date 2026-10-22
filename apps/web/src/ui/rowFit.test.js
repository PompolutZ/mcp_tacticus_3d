import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fitRows, MIN_SCALE, ROW_HEIGHT } from './rowFit.js'

const total = (count, rowHeight, scale) => count * rowHeight * scale

test('Plenty of room: rows keep the default size', () => {
  const r = fitRows({ available: 2000, count: 7, rowHeight: ROW_HEIGHT })
  assert.equal(r.scale, 1)
  assert.equal(r.scroll, false)
})

test('7 rows fit in the given height, never above the default size', () => {
  for (const available of [260, 300, 350, 400, 450, 500, 900]) {
    const r = fitRows({ available, count: 7, rowHeight: ROW_HEIGHT })
    assert.ok(r.scale <= 1)
    if (!r.scroll) {
      assert.ok(r.scale >= MIN_SCALE)
      assert.ok(total(7, ROW_HEIGHT, r.scale) <= available)
    }
  }
})

test('Less room, smaller rows', () => {
  const a = fitRows({ available: 400, count: 7, rowHeight: ROW_HEIGHT })
  const b = fitRows({ available: 300, count: 7, rowHeight: ROW_HEIGHT })
  assert.ok(b.scale < a.scale)
  assert.equal(a.scroll, false)
  assert.equal(b.scroll, false)
})

test('Below the minimum: the minimum size and scroll', () => {
  const r = fitRows({ available: 100, count: 7, rowHeight: ROW_HEIGHT })
  assert.equal(r.scale, MIN_SCALE)
  assert.equal(r.scroll, true)
})

test('No rows or nothing measured: no scaling, no scroll flag', () => {
  const none = { scale: 1, scroll: false }
  assert.deepEqual(fitRows({ available: 100, count: 0, rowHeight: ROW_HEIGHT }), none)
  assert.deepEqual(fitRows({ available: NaN, count: 3, rowHeight: ROW_HEIGHT }), none)
})
