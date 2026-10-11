import { test } from 'node:test'
import assert from 'node:assert/strict'
import jarvis from '../characters/jarvis-characters.json' with { type: 'json' }
import {
  DEFAULT_AFFILIATION,
  affiliationKey,
  autoAffiliation,
  squadAffiliations,
} from './affiliations.js'

const m = (affiliations, rogue = false) => ({ affiliations, rogue })

test('squadAffiliations: one choice', () => {
  assert.deepEqual(
    squadAffiliations([m(['avengers']), m(['avengers', 'asgard']), m(['avengers'])]),
    ['avengers'],
  )
})

test('squadAffiliations: two choices, sorted by name', () => {
  assert.deepEqual(
    squadAffiliations([m(['avengers', 'asgard']), m(['asgard', 'avengers']), m(['avengers'])]),
    ['asgard', 'avengers'],
  )
})

test('squadAffiliations: none, and an empty list', () => {
  assert.deepEqual(squadAffiliations([m(['avengers']), m(['asgard']), m([])]), [])
  assert.deepEqual(squadAffiliations([]), [])
})

test('squadAffiliations: exactly half is not more than half', () => {
  assert.deepEqual(
    squadAffiliations([m(['avengers']), m(['avengers']), m(['asgard']), m(['asgard'])]),
    [],
  )
})

test('Rogue Agent adds 1 for an affiliation it lacks', () => {
  assert.deepEqual(
    squadAffiliations([m(['shield'], true), m(['avengers']), m(['avengers']), m(['asgard'])]),
    ['avengers'],
  )
})

test('two Rogue Agents add only 1', () => {
  assert.deepEqual(
    squadAffiliations([m(['shield'], true), m(['shield'], true), m(['avengers']), m(['asgard'])]),
    [],
  )
})

test('a Rogue Agent with the affiliation counts once', () => {
  assert.deepEqual(
    squadAffiliations([m(['avengers'], true), m(['avengers']), m(['asgard']), m(['shield'])]),
    [],
  )
  assert.deepEqual(squadAffiliations([m(['avengers'], true), m(['avengers']), m(['asgard'])]), [
    'asgard',
    'avengers',
  ])
})

test('the Uncanny X-Men slug maps to its token key', () => {
  assert.equal(affiliationKey('uncanny-x-men'), 'uncanny-xmen')
  assert.deepEqual(squadAffiliations([m(['uncanny-x-men']), m(['uncanny-x-men'])]), [
    'uncanny-xmen',
  ])
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

test('only Taskmaster and Winter Soldier have the tag rogueAgent', () => {
  const rogues = jarvis.filter((row) => (row.tags ?? []).includes('rogueAgent')).map((r) => r.slug)
  assert.deepEqual(rogues.sort(), ['taskmaster', 'winter-soldier'])
})
