import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_FILTERS,
  NO_FILTERS,
  filtersWithSquad,
  matchesFilters,
  squadCombinations,
} from './breakdown.js'

// A unit with its own name and alter ego unless given
const unit = (place, threat, extra = {}) => ({
  place,
  name: `n${place}`,
  threat,
  alterEgo: `ego${place}`,
  peerless: false,
  ...extra,
})
const places = (list) => list.map((c) => c.places)

test('exact total: a set under the value is left out', () => {
  const units = [unit(0, 5), unit(1, 5), unit(2, 5)]
  assert.deepEqual(places(squadCombinations(units, 10)), [
    [0, 1],
    [0, 2],
    [1, 2],
  ])
  const mixed = [unit(0, 5), unit(1, 5), unit(2, 1)]
  assert.deepEqual(places(squadCombinations(mixed, 11)), [[0, 1, 2]])
  assert.deepEqual(places(squadCombinations(mixed, 10)), [[0, 1]])
})

test('exact total: a value no set reaches gives an empty list', () => {
  const units = [unit(0, 5), unit(1, 5), unit(2, 5)]
  assert.deepEqual(squadCombinations(units, 4), [])
  assert.deepEqual(squadCombinations(units, 11), [])
})

test('alter ego: shared is out, null never matches', () => {
  const same = [unit(0, 3, { alterEgo: 'A' }), unit(1, 3, { alterEgo: 'A' })]
  assert.deepEqual(places(squadCombinations(same, 3)), [[0], [1]])
  const nulls = [unit(0, 3, { alterEgo: null }), unit(1, 3, { alterEgo: null })]
  assert.deepEqual(places(squadCombinations(nulls, 6)), [[0, 1]])
})

test('Sentinel exception: the shared alter ego does not count', () => {
  const units = [
    unit(0, 3, { name: 'Sentinel MK4', alterEgo: 'Sentinel MK4' }),
    unit(1, 3, { name: 'Sentinel MK4', alterEgo: 'Sentinel MK4' }),
  ]
  assert.deepEqual(places(squadCombinations(units, 6)), [[0, 1]])
})

test('copies: the later copy needs the earlier one', () => {
  const units = [
    unit(0, 3, { name: 'Prime Sentinel', alterEgo: 'Prime Sentinel' }),
    unit(1, 3, { name: 'Prime Sentinel', alterEgo: 'Prime Sentinel' }),
    unit(2, 3),
  ]
  assert.deepEqual(places(squadCombinations(units, 6)), [
    [0, 1],
    [0, 2],
  ])
  // Threat 3: only the first copy or the other unit, and the second copy never alone
  assert.deepEqual(places(squadCombinations(units, 3)), [[0], [2]])
})

test('Peerless: at most one', () => {
  const units = [unit(0, 3, { peerless: true }), unit(1, 3, { peerless: true }), unit(2, 3)]
  assert.deepEqual(places(squadCombinations(units, 6)), [
    [0, 2],
    [1, 2],
  ])
})

test('sort: by places', () => {
  const units = [unit(0, 4), unit(1, 3), unit(2, 4), unit(3, 3)]
  const list = squadCombinations(units, 7)
  assert.deepEqual(places(list), [
    [0, 1],
    [0, 3],
    [1, 2],
    [2, 3],
  ])
  const mixed = squadCombinations([unit(0, 2), unit(1, 5), unit(2, 7)], 7)
  assert.deepEqual(places(mixed), [[0, 1], [2]])
  assert.deepEqual(squadCombinations([], 7), [])
})

const combo = (placeList, affiliations = []) => ({
  places: placeList,
  threat: 10,
  affiliations: affiliations.map(([key, leader]) => ({ key, leader })),
})

test('filters', () => {
  const c = combo(
    [0, 1, 2],
    [
      ['avengers', true],
      ['cabal', false],
    ],
  )
  assert.equal(matchesFilters(c, NO_FILTERS), true)
  assert.equal(matchesFilters(c, { ...NO_FILTERS, must: [0, 2] }), true)
  assert.equal(matchesFilters(c, { ...NO_FILTERS, must: [0, 3] }), false)
  // mustNot is not checked here
  assert.equal(matchesFilters(c, { ...NO_FILTERS, mustNot: [0] }), true)
  assert.equal(matchesFilters(c, { ...NO_FILTERS, minSize: 4 }), false)
  assert.equal(matchesFilters(c, { ...NO_FILTERS, minSize: 3, maxSize: 3 }), true)
  assert.equal(matchesFilters(c, { ...NO_FILTERS, maxSize: 2 }), false)
  assert.equal(matchesFilters(c, { ...NO_FILTERS, affiliation: '*' }), true)
  assert.equal(matchesFilters(combo([0]), { ...NO_FILTERS, affiliation: '*' }), false)
  assert.equal(matchesFilters(c, { ...NO_FILTERS, affiliation: 'cabal' }), true)
  assert.equal(matchesFilters(c, { ...NO_FILTERS, affiliation: 'asgard' }), false)
  assert.equal(matchesFilters(c, { ...NO_FILTERS, dual: true }), true)
  assert.equal(matchesFilters(combo([0], [['cabal', false]]), { ...NO_FILTERS, dual: true }), false)
})

test('filters: leader', () => {
  const c = combo(
    [0, 1],
    [
      ['avengers', true],
      ['cabal', false],
    ],
  )
  const leader = { ...NO_FILTERS, leader: true }
  assert.equal(matchesFilters(c, leader), true)
  assert.equal(matchesFilters(combo([0], [['cabal', false]]), leader), false)
  assert.equal(matchesFilters(combo([0]), leader), false)
  assert.equal(matchesFilters(c, { ...leader, affiliation: 'avengers' }), true)
  assert.equal(matchesFilters(c, { ...leader, affiliation: 'cabal' }), false)
  assert.equal(matchesFilters(c, { ...leader, dual: true }), false)
  assert.equal(matchesFilters(c, { ...leader, affiliation: '*' }), true)
  // The start filters keep a combination without a leader out.
  assert.equal(matchesFilters(combo([0]), DEFAULT_FILTERS), false)
  assert.equal(matchesFilters(combo([0]), NO_FILTERS), true)
})

test('squad filters: Must have equals the squad, its places leave Must not have, the rest stays', () => {
  const before = { ...DEFAULT_FILTERS, must: [5], mustNot: [1, 2, 3], dual: true, minSize: 4 }
  const after = filtersWithSquad(before, [2, 0])
  assert.deepEqual(after.must, [0, 2])
  assert.deepEqual(after.mustNot, [1, 3])
  assert.deepEqual({ ...after, must: 0, mustNot: 0 }, { ...before, must: 0, mustNot: 0 })
  assert.deepEqual(filtersWithSquad(before, []).must, [])
})
