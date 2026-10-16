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
