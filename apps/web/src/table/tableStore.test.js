import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTableStore } from './tableStore.js'

test('the net objects are kept as given', () => {
  const table = { transact() {} }
  const ownership = {}
  const store = createTableStore({ table, ownership })
  const s = store.getState()
  assert.equal(s.table, table)
  assert.equal(s.ownership, ownership)
  assert.equal(s.pieceLives.size, 0)
  assert.equal(s.sceneApi.current, null)
  assert.equal(s.presence, null)
  assert.equal(s.live, null)
})

test('the other slices start empty', () => {
  const s = createTableStore({ table: {} }).getState()
  assert.equal(s.pieceLives.size, 0)
  assert.equal(s.tokenDrag, null)
  assert.equal(s.rangeMark, null)
  assert.equal(s.overlapIds.size, 0)
  assert.deepEqual(s.sideColors, { host: 'blue', guest: 'red' })
})

test('setState notifies a subscriber', () => {
  const store = createTableStore({ table: {} })
  let calls = 0
  store.subscribe(() => calls++)
  store.setState({ spectator: true })
  assert.equal(calls, 1)
  assert.equal(store.getState().spectator, true)
})

test('an action calls the newest registered implementation, with no store change', () => {
  const store = createTableStore({ table: {} })
  const { actions, registerActions } = store.getState()
  let notified = 0
  store.subscribe(() => notified++)
  assert.equal(actions.onCardOpen('x'), undefined)
  registerActions({ onCardOpen: (v) => `a${v}`, phases: { power: (v) => `p${v}` } })
  assert.equal(actions.onCardOpen(1), 'a1')
  assert.equal(actions.phases.power(2), 'p2')
  registerActions({ onCardOpen: (v) => `b${v}` })
  assert.equal(actions.onCardOpen(1), 'b1')
  assert.equal(actions.phases.power(2), undefined)
  assert.equal(store.getState().actions, actions)
  assert.equal(notified, 0)
})
