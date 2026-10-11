import { test } from 'node:test'
import assert from 'node:assert/strict'
import jarvis from '../characters/jarvis-characters.json' with { type: 'json' }
import {
  DEFAULT_AFFILIATION,
  affiliationKey,
  autoAffiliation,
  squadAffiliations,
} from './affiliations.js'

test('squadAffiliations: one choice', () => {
  assert.deepEqual(squadAffiliations([['avengers'], ['avengers', 'asgard'], ['avengers']]), [
    'avengers',
  ])
})

test('squadAffiliations: two choices, sorted by name', () => {
  assert.deepEqual(
    squadAffiliations([['avengers', 'asgard'], ['asgard', 'avengers'], ['avengers']]),
    ['asgard', 'avengers'],
  )
})

test('squadAffiliations: none, and an empty list', () => {
  assert.deepEqual(squadAffiliations([['avengers'], ['asgard'], []]), [])
  assert.deepEqual(squadAffiliations([]), [])
})

test('squadAffiliations: exactly half is not more than half', () => {
  assert.deepEqual(squadAffiliations([['avengers'], ['avengers'], ['asgard'], ['asgard']]), [])
})

test('the Uncanny X-Men slug maps to its token key', () => {
  assert.equal(affiliationKey('uncanny-x-men'), 'uncanny-xmen')
  assert.deepEqual(squadAffiliations([['uncanny-x-men'], ['uncanny-x-men']]), ['uncanny-xmen'])
  assert.equal(affiliationKey('no-such-affiliation'), null)
})

test('autoAffiliation: 0, 1 and 2 keys', () => {
  assert.equal(autoAffiliation([]), DEFAULT_AFFILIATION)
  assert.equal(autoAffiliation(['asgard']), 'asgard')
  assert.equal(autoAffiliation(['asgard', 'avengers']), null)
})

test('every affiliation slug in jarvis-characters.json has a token', () => {
  const missing = new Set()
  for (const row of jarvis) {
    for (const a of row.affiliations ?? []) if (!affiliationKey(a.slug)) missing.add(a.slug)
  }
  assert.deepEqual([...missing], [])
})
