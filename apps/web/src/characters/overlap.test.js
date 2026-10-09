import test from 'node:test'
import assert from 'node:assert/strict'
import { overlapMarks } from './overlap.js'

const model = (id, x, moved, extra = {}) => ({ id, x, y: 0, z: 0, radius: 1, moved, ...extra })

test('no mark without an overlap', () => {
  assert.equal(overlapMarks([model('a', 0, 1), model('b', 5, 2)]).size, 0)
  assert.equal(overlapMarks([]).size, 0)
})

test('touching bases have no mark', () => {
  assert.equal(overlapMarks([model('a', 0, 1), model('b', 2, 2)]).size, 0)
  // Overlap of 0.01" or less (here 0.005") is touching
  assert.equal(overlapMarks([model('a', 0, 1), model('b', 1.995, 2)]).size, 0)
})

test('of two overlapping models, only the one moved last has the mark', () => {
  assert.deepEqual([...overlapMarks([model('a', 0, 1), model('b', 1, 2)])], ['b'])
  assert.deepEqual([...overlapMarks([model('a', 0, 3), model('b', 1, 2)])], ['a'])
})

test('models that never moved have no mark', () => {
  assert.equal(overlapMarks([model('a', 0, 0), model('b', 1, 0)]).size, 0)
})

test('a lifted model, at another height, has no mark', () => {
  assert.equal(overlapMarks([model('a', 0, 1), model('b', 1, 2, { y: 6 })]).size, 0)
})

test('three models in a row', () => {
  // a overlaps b, b overlaps c, a and c are apart
  const row = (ma, mb, mc) => [model('a', 0, ma), model('b', 1.5, mb), model('c', 3, mc)]
  assert.deepEqual([...overlapMarks(row(1, 2, 3))].sort(), ['b', 'c'])
  // The middle one moved first: both ends have the mark
  assert.deepEqual([...overlapMarks(row(2, 1, 3))].sort(), ['a', 'c'])
  // The middle one moved last: only it has the mark
  assert.deepEqual([...overlapMarks(row(1, 3, 2))], ['b'])
})
