import test from 'node:test'
import assert from 'node:assert/strict'
import { ndcFromClient, nearestHit } from './screenRay.js'

const canvas = { getBoundingClientRect: () => ({ left: 100, top: 50, width: 200, height: 100 }) }

test('ndcFromClient maps corners and center', () => {
  assert.deepEqual(ndcFromClient(canvas, 100, 50), { x: -1, y: 1 })
  assert.deepEqual(ndcFromClient(canvas, 300, 150), { x: 1, y: -1 })
  assert.deepEqual(ndcFromClient(canvas, 200, 100), { x: 0, y: 0 })
})

const raycaster = {
  intersectObject: (object) =>
    object.distance === undefined ? [] : [{ distance: object.distance }],
}

test('nearestHit gives the nearest value', () => {
  const entries = [
    ['far', { distance: 5 }],
    ['near', { distance: 2 }],
    ['miss', {}],
  ]
  assert.equal(nearestHit(raycaster, entries), 'near')
})

test('nearestHit skips entries without an object and gives null with no hit', () => {
  assert.equal(
    nearestHit(raycaster, [
      ['a', null],
      ['b', undefined],
    ]),
    null,
  )
  assert.equal(nearestHit(raycaster, [['a', {}]]), null)
  assert.equal(nearestHit(raycaster, new Map([['x', { distance: 1 }]])), 'x')
})
