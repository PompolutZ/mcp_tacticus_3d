import test from 'node:test'
import assert from 'node:assert/strict'
import { moveLength, rangeLength, MOVE_TIP, RANGE_TIP, RANGE_HALF_WIDTH } from './toolTips.js'
import { rackSlots } from './layout.js'

test('a range grows with its size, and R1 is the tool width, the shortest', () => {
  const sizes = [1, 2, 3, 4, 5].map(rangeLength)
  for (let i = 1; i < sizes.length; i++) assert.ok(sizes[i] > sizes[i - 1])
  assert.equal(rangeLength(1), 2 * RANGE_HALF_WIDTH)
})

test('a range is the whole long side of its tool: two halves tip to tip', () => {
  for (const n of [2, 3, 4, 5]) assert.equal(rangeLength(n), RANGE_TIP[n] + RANGE_TIP[n])
})

test('moves grow short < medium < long, and each is its tool long side', () => {
  assert.ok(moveLength('short') < moveLength('medium'))
  assert.ok(moveLength('medium') < moveLength('long'))
  for (const t of ['short', 'medium', 'long'])
    assert.equal(moveLength(t), MOVE_TIP[t] + MOVE_TIP[t])
})

test('an unknown size is an error, not NaN', () => {
  assert.throws(() => rangeLength(6))
  assert.throws(() => moveLength('huge'))
})

test('the rack lays each tool at its size length', () => {
  const slot = (key) => rackSlots('host').find((s) => s.key === key)
  for (const n of [2, 3, 4, 5]) assert.equal(slot(`r${n}`).length, rangeLength(n))
  assert.equal(slot('s').length, moveLength('short'))
  assert.equal(slot('l').length, moveLength('long'))
})
