import test from 'node:test'
import assert from 'node:assert/strict'
import {
  joinNames,
  modelsToReturn,
  placedToken,
  placerSide,
  waitGroups,
  waitText,
  waitingTokens,
} from './dropWait.js'

const from = (characterId, offBoard = false) => ({ characterId, x: 1, z: 2, radius: 0.5, offBoard })
const waits = (id, characterId, offBoard) => ({
  id,
  placeBy: 'guest',
  placeFrom: from(characterId, offBoard),
})

test('the opponent places, or the controlling player', () => {
  assert.equal(placerSide('host', 'opponent'), 'guest')
  assert.equal(placerSide('guest', 'opponent'), 'host')
  assert.equal(placerSide('host', 'controller'), 'host')
})

test('waiting tokens are grouped by character', () => {
  const tokens = [waits('a', 'c1'), { id: 'x', placeBy: null }, waits('b', 'c2'), waits('c', 'c1')]
  assert.equal(waitingTokens(tokens).length, 3)
  const groups = waitGroups(tokens)
  assert.deepEqual(
    groups.map((g) => [g.characterId, g.tokens.map((t) => t.id)]),
    [
      ['c1', ['a', 'c']],
      ['c2', ['b']],
    ],
  )
})

test('names are joined', () => {
  assert.equal(joinNames(['Asset']), 'Asset')
  assert.equal(joinNames(['Asset', 'Civilian']), 'Asset and Civilian')
  assert.equal(joinNames(['Asset', 'Civilian', 'Asset']), 'Asset, Civilian and Asset')
})

test('the text for the placing player and for the other', () => {
  const base = { name: 'Hulk', tokenNames: ['Asset'], placer: 'Nelly' }
  assert.equal(waitText({ ...base, mine: true }), "Place Hulk's Asset within Range 2")
  assert.equal(waitText({ ...base, mine: false }), "Waiting for Nelly to place Hulk's Asset")
})

test('models return when the last token of a Remove is placed', () => {
  const tokens = [waits('a', 'c1', true), waits('b', 'c1', true), waits('c', 'c2', false)]
  assert.deepEqual(modelsToReturn(tokens, ['a']), [])
  assert.deepEqual(modelsToReturn(tokens, ['a', 'b']), ['c1'])
  assert.deepEqual(modelsToReturn(tokens, ['c']), [])
})

test('a token that is not waiting returns nothing', () => {
  const tokens = [{ id: 'a', placeBy: null, placeFrom: null }]
  assert.deepEqual(modelsToReturn(tokens, ['a']), [])
})

test('a placed token has no wait and is not held', () => {
  const placed = placedToken({ ...waits('a', 'c1'), heldBy: 'c1', x: 0, z: 0 }, { x: 4, z: 5 })
  assert.equal(placed.placeBy, null)
  assert.equal(placed.placeFrom, null)
  assert.equal(placed.heldBy, null)
  assert.deepEqual([placed.x, placed.z], [4, 5])
  assert.equal(placedToken({ ...waits('a', 'c1'), x: 7, z: 8 }, null).x, 7)
})
