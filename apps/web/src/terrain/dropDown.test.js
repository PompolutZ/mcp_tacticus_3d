import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dropPlan, fallDelta, sampleGrid, standsOnIds } from './dropDown.js'

test('sampleGrid: cell centers', () => {
  const pts = sampleGrid({ minX: 0, maxX: 4, minZ: 0, maxZ: 2 }, 2)
  assert.deepEqual(pts, [
    { x: 1, z: 0.5 },
    { x: 1, z: 1.5 },
    { x: 3, z: 0.5 },
    { x: 3, z: 1.5 },
  ])
})

test('standsOnIds: near surfaces of pieces only, no repeat', () => {
  const hits = [
    { id: 'a', gap: 0 },
    { id: 'a', gap: 0.1 },
    { id: 'b', gap: 1 },
    { id: null, gap: 0 },
    { id: 'c', gap: -0.2 },
  ]
  assert.deepEqual(standsOnIds(hits), ['a', 'c'])
})

test('fallDelta: lands on the highest surface or the table', () => {
  assert.equal(fallDelta(2.774, [1.9, 0.5]), 2.774 - 1.9)
  assert.equal(fallDelta(2, []), 2)
  assert.equal(fallDelta(1, [3]), 0)
})

test('dropPlan: only what stood on the removed piece falls', () => {
  const plan = dropPlan({
    removedId: 'A',
    standsOn: { 'model:1': ['A'], 'model:2': ['B'], 'terrain:C': [] },
    landing: () => 2,
  })
  assert.deepEqual(plan, [{ key: 'model:1', delta: 2 }])
})

test('dropPlan: a chain goes down by the delta of its support', () => {
  const plan = dropPlan({
    removedId: 'A',
    standsOn: { 'terrain:P': ['A'], 'terrain:Q': ['P'], 'model:1': ['Q'], 'model:2': ['A'] },
    landing: (key) => (key === 'terrain:P' ? 1.5 : 0.5),
  })
  assert.deepEqual(plan, [
    { key: 'terrain:P', delta: 1.5 },
    { key: 'model:2', delta: 0.5 },
    { key: 'terrain:Q', delta: 1.5 },
    { key: 'model:1', delta: 1.5 },
  ])
})

test('dropPlan: a piece that does not fall keeps its stack in place', () => {
  const plan = dropPlan({
    removedId: 'A',
    standsOn: { 'terrain:P': ['A'], 'model:1': ['P'] },
    landing: () => 0,
  })
  assert.deepEqual(plan, [])
})

test('dropPlan: a loop of supports ends', () => {
  const plan = dropPlan({
    removedId: 'A',
    standsOn: { 'terrain:P': ['A', 'Q'], 'terrain:Q': ['P'] },
    landing: () => 1,
  })
  assert.equal(plan.length, 2)
})
