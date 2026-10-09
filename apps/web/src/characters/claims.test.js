import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MODEL_CLAIM_MIN, claimChanges, claimCheck, modelIdOfKey, modelKey } from './claims.js'

const rested = { age: 1, dynamic: true, asleep: true, busy: false, gone: false }

test('a model at rest, claim old enough: rest', () => {
  assert.equal(claimCheck(rested), 'rest')
  assert.equal(claimCheck({ ...rested, age: MODEL_CLAIM_MIN }), 'rest')
})

test('a young claim is kept', () => {
  assert.equal(claimCheck({ ...rested, age: 0.1 }), 'keep')
})

test('an awake, kinematic or busy model is kept', () => {
  assert.equal(claimCheck({ ...rested, asleep: false }), 'keep')
  assert.equal(claimCheck({ ...rested, dynamic: false }), 'keep')
  assert.equal(claimCheck({ ...rested, busy: true }), 'keep')
})

test('a model that is gone releases, at any age', () => {
  assert.equal(claimCheck({ ...rested, age: 0, asleep: false, gone: true }), 'release')
})

test('keys', () => {
  assert.equal(modelKey('a-2'), 'character:a-2')
  assert.equal(modelIdOfKey('character:a-2'), 'a-2')
  assert.equal(modelIdOfKey('token:3'), null)
})

test('claimChanges: started, ended, gone', () => {
  const prev = new Set(['character:a', 'character:b'])
  const next = new Set(['character:b', 'character:c'])
  assert.deepEqual(claimChanges(prev, next, true), {
    started: ['character:c'],
    ended: ['character:a'],
    gone: [],
  })
  assert.deepEqual(claimChanges(prev, next, false), {
    started: ['character:c'],
    ended: [],
    gone: ['character:a'],
  })
  assert.deepEqual(claimChanges(prev, prev, true), { started: [], ended: [], gone: [] })
})
