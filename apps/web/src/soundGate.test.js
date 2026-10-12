import test from 'node:test'
import assert from 'node:assert/strict'
import { CAP_COUNT, CAP_MS, KEY_GAP_MS, createBumpGate } from './soundGate.js'

test('one key plays at most once in the key gap', () => {
  const allow = createBumpGate()
  assert.equal(allow('a', 1000), true)
  assert.equal(allow('a', 1000 + KEY_GAP_MS - 1), false)
  assert.equal(allow('a', 1000 + KEY_GAP_MS), true)
})

test('a refused bump does not restart the key gap', () => {
  const allow = createBumpGate()
  allow('a', 0)
  assert.equal(allow('a', 50), false)
  assert.equal(allow('a', KEY_GAP_MS), true)
})

test('different keys do not block each other', () => {
  const allow = createBumpGate()
  assert.equal(allow('a', 0), true)
  assert.equal(allow('b', 0), true)
})

test('all keys together play at most the cap in the cap window', () => {
  const allow = createBumpGate()
  for (let i = 0; i < CAP_COUNT; i++) assert.equal(allow(`k${i}`, i), true)
  assert.equal(allow('extra', CAP_COUNT), false)
  assert.equal(allow('extra', CAP_MS), true)
})

test('a refused bump by the cap does not set the key gap', () => {
  const allow = createBumpGate()
  for (let i = 0; i < CAP_COUNT; i++) allow(`k${i}`, 0)
  assert.equal(allow('x', 10), false)
  assert.equal(allow('x', CAP_MS), true)
})
