import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  average,
  chiPValue,
  chiSquared,
  chiTest,
  expectedCounts,
  faceCounts,
  max,
  percentile,
  symbolCounts,
  symbolShares,
} from './diceStats.mjs'

const EVEN = Array.from({ length: 8 }, () => 125)
const near = (a, b, eps) => assert.ok(Math.abs(a - b) < eps, `${a} not within ${eps} of ${b}`)

test('p-value matches known chi-squared table values', () => {
  near(chiPValue(14.067, 7), 0.05, 0.001)
  near(chiPValue(11.07, 5), 0.05, 0.001)
  near(chiPValue(18.475, 7), 0.01, 0.001)
  near(chiPValue(0, 7), 1, 1e-9)
  near(chiPValue(2.1673, 7), 0.95, 0.001)
})

test('chiSquared and chiTest', () => {
  assert.equal(chiSquared([10, 10], [10, 10]), 0)
  near(chiSquared([15, 5], [10, 10]), 5, 1e-9)
  const even = chiTest(EVEN, EVEN)
  assert.equal(even.pass, true)
  assert.equal(even.df, 7)
  const biased = chiTest([200, 100, 100, 100, 100, 100, 100, 100], EVEN)
  assert.equal(biased.pass, false)
})

test('symbol shares: hit and blank 2/8, others 1/8', () => {
  const s = symbolShares()
  assert.equal(s.hit, 0.25)
  assert.equal(s.blank, 0.25)
  assert.equal(s.crit, 0.125)
  assert.equal(s.skull, 0.125)
  near(
    Object.values(s).reduce((a, b) => a + b, 0),
    1,
    1e-12,
  )
})

test('counts', () => {
  assert.deepEqual(faceCounts([1, 1, 8, 3]), [2, 0, 1, 0, 0, 0, 0, 1])
  const c = symbolCounts(['hit', 'hit', 'skull'])
  assert.equal(c.hit, 2)
  assert.equal(c.skull, 1)
  assert.equal(c.wild, 0)
  assert.deepEqual(expectedCounts(8, [0.25, 0.125]), [2, 1])
})

test('percentile, average, max', () => {
  assert.equal(percentile([5, 1, 3], 50), 3)
  assert.equal(percentile([1, 2, 3, 4], 0), 1)
  assert.equal(percentile([1, 2, 3, 4], 100), 4)
  near(percentile([1, 2, 3, 4], 50), 2.5, 1e-12)
  near(
    percentile(
      Array.from({ length: 101 }, (_, i) => i),
      95,
    ),
    95,
    1e-12,
  )
  assert.equal(percentile([], 95), 0)
  assert.equal(average([1, 2, 3]), 2)
  assert.equal(average([]), 0)
  assert.equal(max([1, 9, 3]), 9)
})
