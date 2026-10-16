import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withAffiliationSource } from '../tokens/affiliationTokens.js'

const keys = ['activated', 'dazed', 'root', 'shock']

test('no affiliation or Unaffiliated: the row is as before', () => {
  assert.deepEqual(withAffiliationSource(keys, null, 2), keys)
  assert.deepEqual(withAffiliationSource(keys, undefined, 2), keys)
  assert.deepEqual(withAffiliationSource(keys, 'unaffiliated', 2), keys)
})

test('an affiliation puts its token after Dazed', () => {
  assert.deepEqual(withAffiliationSource(keys, 'avengers', 2), [
    'activated',
    'dazed',
    'affiliation-avengers',
    'root',
    'shock',
  ])
})
