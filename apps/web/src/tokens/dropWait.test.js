import test from 'node:test'
import assert from 'node:assert/strict'
import {
  RANGE_2,
  clampToRange,
  clampWaiting,
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

test('Range 2 is the length of the Range 2 tool', () => {
  assert.equal(RANGE_2, 3.002)
})

test('clampToRange keeps a point inside, and cuts one outside along the line to the centre', () => {
  const centre = { x: 1, z: 1 }
  const inside = { x: 2, z: 2 }
  assert.equal(clampToRange(inside, centre, 5), inside)
  const out = clampToRange({ x: 11, z: 1 }, centre, 4)
  assert.deepEqual(out, { x: 5, z: 1 })
  const diag = clampToRange({ x: 4, z: 5 }, centre, 2.5)
  assert.ok(Math.abs(diag.x - 2.5) < 1e-9 && Math.abs(diag.z - 3) < 1e-9)
  assert.equal(clampToRange({ x: 1, z: 1 }, centre, 0).x, 1)
})

test('a waiting token stays within base radius + Range 2 + token radius', () => {
  const token = { placeBy: 'guest', placeFrom: from('c1') }
  const p = clampWaiting(token, { x: 100, z: 2 }, 0.5)
  assert.ok(Math.abs(p.x - (1 + 0.5 + RANGE_2 + 0.5)) < 1e-9)
  assert.equal(p.z, 2)
})

test('a token that does not wait is not limited', () => {
  const point = { x: 100, z: 2 }
  assert.equal(clampWaiting({ placeBy: null, placeFrom: null }, point, 0.5), point)
  assert.equal(clampWaiting({ placeBy: 'host', placeFrom: null }, point, 0.5), point)
})
