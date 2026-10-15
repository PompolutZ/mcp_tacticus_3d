import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_DICE, shelfFromDocument } from './shelfStart.js'

const shelfDie = (order, face) => ({ order, place: 'shelf', face })

test('shelf dice start in order, each at its slot, kinematic and still', () => {
  const side = { dice: { b: shelfDie(2, 3), a: shelfDie(1, 5) } }
  const { dice, ids } = shelfFromDocument('guest', side)
  assert.deepEqual([...ids].sort(), ['a', 'b'])
  assert.equal(ids.length, 2)
  const a = dice.get('a')
  const b = dice.get('b')
  assert.equal(a.slot, 0)
  assert.equal(b.slot, 1)
  assert.equal(a.state, 'shelf')
  assert.equal(a.moving, false)
  assert.deepEqual(a.doc, { order: 1, place: 'shelf', face: 5 })
  assert.equal(a.face, 5)
  assert.equal(typeof a.symbol, 'string')
})

test('a bad face and a missing order are skipped', () => {
  const side = {
    dice: {
      ok: shelfDie(1, 2),
      zero: shelfDie(2, 0),
      big: shelfDie(3, 99),
      noOrder: { place: 'shelf', face: 2 },
      well: { order: 4, place: 'well' },
    },
  }
  assert.deepEqual(shelfFromDocument('guest', side).ids, ['ok'])
})

test('at most 42 dice start', () => {
  const dice = {}
  for (let i = 0; i < 50; i++) dice[`d${i}`] = shelfDie(i, 1)
  assert.equal(MAX_DICE, 42)
  assert.equal(shelfFromDocument('guest', { dice }).ids.length, 42)
})

test('critsUsed is true only when stored as true; no side gives an empty start', () => {
  assert.equal(shelfFromDocument('guest', { critsUsed: true }).critsUsed, true)
  assert.equal(shelfFromDocument('guest', { critsUsed: 1 }).critsUsed, false)
  const none = shelfFromDocument('guest', undefined)
  assert.equal(none.critsUsed, false)
  assert.equal(none.ids.length, 0)
  assert.deepEqual(none.docDice, {})
})
