import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addOne,
  clickAdd,
  countOf,
  dropCollected,
  firstPlace,
  mergeCounts,
  mergeTarget,
  takeOne,
} from './count.js'

const tok = (id, x, z, extra = {}) => ({ id, key: 'k', x, z, ...extra })

test('count is 1 when absent, and 1 has no field', () => {
  assert.equal(countOf(tok('a', 0, 0)), 1)
  assert.deepEqual(addOne(tok('a', 0, 0)), tok('a', 0, 0, { count: 2 }))
  assert.deepEqual(takeOne(tok('a', 0, 0, { count: 2 })), tok('a', 0, 0))
  assert.deepEqual(takeOne(tok('a', 0, 0, { count: 3 })), tok('a', 0, 0, { count: 2 }))
})

test('merge adds the counts', () => {
  const merged = mergeCounts(tok('a', 0, 0, { count: 2 }), tok('b', 0, 0, { count: 3 }))
  assert.equal(merged.count, 5)
  assert.equal(mergeCounts(tok('a', 0, 0), tok('b', 0, 0)).count, 2)
})

test('the merge target is the top token of the same kind under the point', () => {
  const list = [tok('a', 0, 0), tok('b', 0.1, 0), { ...tok('c', 0, 0), key: 'other' }]
  assert.equal(mergeTarget(list, 'k', { x: 0, z: 0 }, 0.4)?.id, 'b')
  assert.equal(mergeTarget(list, 'k', { x: 0, z: 0 }, 0.4, 'b')?.id, 'a')
  assert.equal(mergeTarget(list, 'k', { x: 5, z: 0 }, 0.4), undefined)
})

test('a click adds to the token of the pile, or puts the first one', () => {
  const pile = { id: 'p', key: 'k', x: 0, z: 0, card: 'c' }
  const first = clickAdd([], pile, { x: 3, z: 4 }, 'n')
  assert.deepEqual(first, [{ id: 'n', key: 'k', x: 3, z: 4, pile: 'p' }])
  const second = clickAdd(first, pile, { x: 3, z: 4 }, 'm')
  assert.deepEqual(second, [{ id: 'n', key: 'k', x: 3, z: 4, pile: 'p', count: 2 }])
  const other = [tok('z', 3, 4, { pile: 'q' })]
  assert.equal(clickAdd(other, pile, { x: 3, z: 4 }, 'n').length, 2)
})

test('the first place is the card center, else a free spot near the pile', () => {
  const pile = { x: 1, z: 1 }
  assert.deepEqual(firstPlace(pile, { x: 7, z: 8 }, [], 0.75), { x: 7, z: 8 })
  const spot = firstPlace(pile, null, [], 0.75)
  assert.ok(Math.hypot(spot.x - 1, spot.z - 1) > 0.75)
  const busy = firstPlace(pile, null, [spot], 0.75)
  assert.ok(Math.hypot(busy.x - spot.x, busy.z - spot.z) >= 0.75)
})

test('take one: the source goes down, the new token lies at the drop', () => {
  const list = [tok('a', 0, 0, { count: 3 })]
  const out = dropCollected(list, tok('n', 5, 5), { x: 5, z: 5 }, 0.4, 'a')
  assert.deepEqual(out, [tok('a', 0, 0, { count: 2 }), tok('n', 5, 5)])
})

test('a drop on a token of the same kind merges, the dragged one is gone', () => {
  const list = [tok('a', 0, 0, { count: 2 }), tok('b', 5, 5, { count: 2 })]
  const out = dropCollected(list, list[1], { x: 0.1, z: 0 }, 0.4)
  assert.deepEqual(out, [tok('a', 0, 0, { count: 4 })])
})

test('a taken token dropped back on its source restores the count', () => {
  const list = [tok('a', 0, 0, { count: 3 })]
  const out = dropCollected(list, tok('n', 0, 0), { x: 0, z: 0 }, 0.4, 'a')
  assert.deepEqual(out, [tok('a', 0, 0, { count: 3 })])
})

test('a moved token with no target goes to the end at the drop', () => {
  const list = [tok('a', 0, 0), tok('b', 5, 5)]
  const out = dropCollected(list, list[0], { x: 9, z: 9 }, 0.4)
  assert.deepEqual(out, [tok('b', 5, 5), tok('a', 9, 9)])
})
