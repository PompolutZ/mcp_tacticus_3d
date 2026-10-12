import test from 'node:test'
import assert from 'node:assert/strict'
import { tokenDropTarget } from './tokenDrop.js'

const point = { x: 1, y: 0, z: 2 }
const base = { looseId: null, supplyCard: null, pile: false, pileId: null }

test('a new pile and a moved pile go only on the table', () => {
  assert.equal(tokenDropTarget({ ...base, pile: true }, { characterId: null, point }), 'newPile')
  assert.equal(tokenDropTarget({ ...base, pileId: 'p1' }, { characterId: null, point }), 'movePile')
  assert.equal(tokenDropTarget({ ...base, pile: true }, { characterId: 'c1', point }), null)
  assert.equal(tokenDropTarget({ ...base, pileId: 'p1' }, { characterId: 'c1', point }), null)
  assert.equal(tokenDropTarget({ ...base, pile: true }, { characterId: null, point: null }), null)
  assert.equal(tokenDropTarget({ ...base, pileId: 'p1' }, { characterId: null, point: null }), null)
})

test('a supply token is held by a character or lies on the table', () => {
  const supply = { ...base, supplyCard: 'card' }
  assert.equal(tokenDropTarget(supply, { characterId: 'c1', point }), 'supplyHeld')
  assert.equal(tokenDropTarget(supply, { characterId: 'c1', point: null }), 'supplyHeld')
  assert.equal(tokenDropTarget(supply, { characterId: null, point }), 'supplyTable')
  assert.equal(tokenDropTarget(supply, { characterId: null, point: null }), null)
})

test('a token over a character is given, also from the table', () => {
  assert.equal(tokenDropTarget(base, { characterId: 'c1', point }), 'give')
  assert.equal(tokenDropTarget(base, { characterId: 'c1', point: null }), 'give')
  assert.equal(tokenDropTarget({ ...base, looseId: 'l1' }, { characterId: 'c1', point }), 'give')
})

test('a token on the table moves or is new; off the table nothing changes', () => {
  assert.equal(
    tokenDropTarget({ ...base, looseId: 'l1' }, { characterId: null, point }),
    'moveLoose',
  )
  assert.equal(tokenDropTarget(base, { characterId: null, point }), 'newLoose')
  assert.equal(tokenDropTarget(base, { characterId: null, point: null }), null)
  assert.equal(
    tokenDropTarget({ ...base, looseId: 'l1' }, { characterId: null, point: null }),
    null,
  )
})

test('branch order: pile and supply win over a character and over looseId', () => {
  assert.equal(
    tokenDropTarget(
      { ...base, pile: true, supplyCard: 'card', looseId: 'l1' },
      { characterId: null, point },
    ),
    'newPile',
  )
  assert.equal(
    tokenDropTarget({ ...base, supplyCard: 'card', looseId: 'l1' }, { characterId: 'c1', point }),
    'supplyHeld',
  )
  assert.equal(
    tokenDropTarget({ ...base, pileId: 'p1', pile: true }, { characterId: null, point }),
    'movePile',
  )
})
