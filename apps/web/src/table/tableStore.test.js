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

test('the selection setters take a value or an updater and skip an equal result', () => {
  const store = createTableStore({ table: {} })
  const { actions } = store.getState()
  let notified = 0
  store.subscribe(() => notified++)
  actions.dragSelect('character', 'a')
  actions.toggleSelect('token', 't')
  assert.deepEqual(store.getState().selection, [
    { kind: 'character', id: 'a' },
    { kind: 'token', id: 't' },
  ])
  actions.setSelection((prev) => prev)
  actions.setSelectedTools((prev) => ({ ...prev, range: true }))
  assert.equal(store.getState().selectedTools.range, true)
  assert.equal(notified, 3)
})

test('the selection and the selected tools go to presence', () => {
  const sent = []
  const store = createTableStore({ table: {}, presence: { set: (f) => sent.push(f) } })
  const { actions } = store.getState()
  assert.equal(sent.length, 1)
  actions.dragSelect('character', 'a')
  actions.dragSelect('terrain', 'x')
  actions.setSelectedTools((prev) => ({ ...prev, move: true }))
  // the terrain piece changes the selection but not what the other player sees; presence skips the equal field
  assert.equal(sent.length, 4)
  assert.deepEqual(sent.at(-1), { selection: ['character:a'], tools: ['move'] })
})

test('the scene setters skip the same value; overlapIds changes only when the content does', () => {
  const store = createTableStore({ table: {} })
  const { actions } = store.getState()
  let notified = 0
  store.subscribe(() => notified++)
  actions.setDraggingCharId('a')
  actions.setDraggingCharId('a')
  assert.equal(notified, 1)
  actions.setOverlapIds(new Set(['a', 'b']))
  actions.setOverlapIds(new Set(['b', 'a']))
  assert.equal(notified, 2)
  actions.setOverlapIds(new Set(['a']))
  assert.equal(notified, 3)
  const mark = { kind: 'token', id: 't', mode: 'inRange' }
  actions.setRangeMark(mark)
  actions.setRangeMark(mark)
  assert.equal(notified, 4)
})

test('the range mark goes to presence', () => {
  const sent = []
  const store = createTableStore({ table: {}, presence: { set: (f) => sent.push(f) } })
  const { actions } = store.getState()
  actions.setRangeMark({ kind: 'token', id: 't', mode: 'inRange' })
  actions.setRangeMark(null)
  assert.deepEqual(sent.slice(1), [{ mark: { key: 'token:t', mode: 'inRange' } }, { mark: null }])
})
