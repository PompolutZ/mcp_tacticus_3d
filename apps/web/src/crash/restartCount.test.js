import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tooManyErrors } from './restartCount.js'

test('three errors within 10 s give the fallback', () => {
  const times = []
  assert.equal(tooManyErrors(times, 0), false)
  assert.equal(tooManyErrors(times, 1000), false)
  assert.equal(tooManyErrors(times, 2000), true)
})

test('slow errors never give the fallback', () => {
  const times = []
  for (let i = 0; i < 10; i++) assert.equal(tooManyErrors(times, i * 6000), false)
})
