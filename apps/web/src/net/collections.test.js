import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { createList, createRecord, equal } from './collections.js'

// Counts the updates of doc, so a test sees whether a write changed the document
function countUpdates(doc) {
  const counter = { count: 0 }
  doc.on('update', () => counter.count++)
  return counter
}

// Sends the changes of each doc to the other, as the sync of two browsers does
function exchange(a, b) {
  const fromA = Y.encodeStateAsUpdate(a, Y.encodeStateVector(b))
  const fromB = Y.encodeStateAsUpdate(b, Y.encodeStateVector(a))
  Y.applyUpdate(b, fromA)
  Y.applyUpdate(a, fromB)
}

const char = (id, fields = {}) => ({ id, key: 'cap', damage: 0, power: 0, tokens: {}, ...fields })

test('equal compares JSON content and treats undefined as missing', () => {
  assert.ok(equal({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }))
  assert.ok(equal({ a: 1, b: undefined }, { a: 1 }))
  assert.ok(!equal({ a: 1 }, { a: 2 }))
  assert.ok(!equal([1], { 0: 1 }))
  assert.ok(!equal(null, {}))
})

test('a list adds, changes and deletes entities, in the order of the array', () => {
  const doc = new Y.Doc()
  const list = createList(doc.getMap('characters'))
  list.set([char('a'), char('b'), char('c')])
  assert.deepEqual(
    list.read().map(({ id }) => id),
    ['a', 'b', 'c'],
  )
  list.set((prev) => prev.map((ch) => (ch.id === 'b' ? { ...ch, damage: 3 } : ch)))
  assert.equal(list.read()[1].damage, 3)
  list.set((prev) => prev.filter((ch) => ch.id !== 'a'))
  assert.deepEqual(list.read(), [char('b', { damage: 3 }), char('c')])
})

test('a list writes only changed fields, and nothing for an equal array', () => {
  const doc = new Y.Doc()
  const list = createList(doc.getMap('characters'))
  list.set([char('a'), char('b')])
  const ymap = doc.getMap('characters')
  const before = ymap.get('a')
  const updates = countUpdates(doc)
  list.set((prev) => prev.map((ch) => ({ ...ch, tokens: { ...ch.tokens } })))
  assert.equal(updates.count, 0)
  let changed = []
  ymap.observeDeep((events) => {
    changed = events.flatMap((e) => [...e.keysChanged])
  })
  list.set((prev) => prev.map((ch) => (ch.id === 'a' ? { ...ch, power: 2 } : ch)))
  assert.equal(updates.count, 1)
  assert.deepEqual(changed, ['power'])
  assert.equal(ymap.get('a'), before)
})

test('a list deletes a field that the new entity does not have', () => {
  const doc = new Y.Doc()
  const list = createList(doc.getMap('tokens'))
  list.set([{ id: 't', x: 1, heldAt: [0, 1] }])
  list.set([{ id: 't', x: 1, heldAt: undefined }])
  assert.deepEqual(list.read(), [{ id: 't', x: 1 }])
})

test('an entity that moves to the end gets one new order, the others keep theirs', () => {
  const doc = new Y.Doc()
  const list = createList(doc.getMap('tactics'))
  list.set([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
  const ymap = doc.getMap('tactics')
  list.set((prev) => [...prev.filter(({ id }) => id !== 'a'), prev[0]])
  assert.deepEqual(
    list.read().map(({ id }) => id),
    ['b', 'c', 'a'],
  )
  assert.deepEqual(
    ['a', 'b', 'c'].map((id) => ymap.get(id).get('order')),
    [4, 2, 3],
  )
  list.set((prev) => [prev[2], ...prev.slice(0, 2)])
  assert.deepEqual(
    list.read().map(({ id }) => id),
    ['a', 'b', 'c'],
  )
})

test('a list with fields stores only those fields', () => {
  const doc = new Y.Doc()
  const list = createList(doc.getMap('terrain'), { fields: ['index', 'locked'] })
  list.set([{ id: 'p', index: 2, locked: true, piece: 'crate', position: [1, 2] }])
  assert.deepEqual(list.read(), [{ id: 'p', index: 2, locked: true }])
})

test('two setter calls in one transaction see each other', () => {
  const doc = new Y.Doc()
  const list = createList(doc.getMap('tokens'))
  const updates = countUpdates(doc)
  doc.transact(() => {
    list.set((prev) => [...prev, { id: 'a', x: 1 }])
    list.set((prev) => [...prev, { id: 'b', x: 2 }])
    list.set((prev) => prev.map((t) => ({ ...t, x: t.x + 10 })))
  })
  assert.equal(updates.count, 1)
  assert.deepEqual(list.read(), [
    { id: 'a', x: 11 },
    { id: 'b', x: 12 },
  ])
})

test('the list snapshot keeps unchanged entities and is stable without a change', () => {
  const doc = new Y.Doc()
  const list = createList(doc.getMap('characters'))
  let calls = 0
  list.subscribe(() => calls++)
  list.set([char('a'), char('b')])
  const first = list.getSnapshot()
  assert.equal(list.getSnapshot(), first)
  list.set((prev) => prev.map((ch) => (ch.id === 'b' ? { ...ch, damage: 1 } : ch)))
  const second = list.getSnapshot()
  assert.notEqual(second, first)
  assert.equal(second[0], first[0])
  assert.notEqual(second[1], first[1])
  assert.equal(second[1].tokens, first[1].tokens)
  list.set((prev) => [char('x'), ...prev])
  const third = list.getSnapshot()
  assert.equal(third[1], second[0])
  assert.equal(calls, 3)
})

test('a record with depth 1 makes nested maps, and replaces them with null and back', () => {
  const doc = new Y.Doc()
  const setup = createRecord(doc.getMap('setup'), { depth: 1 })
  setup.set({
    deck: null,
    ready: { blue: false, red: false },
    squads: { blue: { characters: [] } },
  })
  const ymap = doc.getMap('setup')
  assert.ok(ymap.get('ready') instanceof Y.Map)
  assert.ok(!(ymap.get('squads').get('blue') instanceof Y.Map))
  setup.setField('deck', { team: 'red', type: 'secure' })
  assert.ok(ymap.get('deck') instanceof Y.Map)
  assert.deepEqual(setup.get('deck'), { team: 'red', type: 'secure' })
  setup.setField('deck', null)
  assert.equal(setup.get('deck'), null)
  setup.set((prev) => ({ ...prev, ready: { ...prev.ready, blue: true } }))
  assert.deepEqual(setup.read(), {
    deck: null,
    ready: { blue: true, red: false },
    squads: { blue: { characters: [] } },
  })
})

test('a record writes nothing for equal values, and its snapshot keeps unchanged fields', () => {
  const doc = new Y.Doc()
  const game = createRecord(doc.getMap('game'), { depth: 1 })
  game.set({
    mapId: 'm',
    crisis: { secure: null, extract: null },
    scoreMarkers: { blue: { x: 1, z: 2 } },
  })
  const first = game.getSnapshot()
  const updates = countUpdates(doc)
  game.set((prev) => ({ ...prev, crisis: { ...prev.crisis } }))
  game.setField('mapId', 'm')
  assert.equal(updates.count, 0)
  game.setField('crisis', (prev) => ({ ...prev, secure: 'card' }))
  const second = game.getSnapshot()
  assert.equal(second.scoreMarkers, first.scoreMarkers)
  assert.deepEqual(second.crisis, { secure: 'card', extract: null })
})

test('two docs merge changes of different fields of one entity', () => {
  const a = new Y.Doc()
  const b = new Y.Doc()
  const listA = createList(a.getMap('characters'))
  const listB = createList(b.getMap('characters'))
  listA.set([char('x')])
  exchange(a, b)
  listA.set((prev) => prev.map((ch) => ({ ...ch, damage: 2 })))
  listB.set((prev) => prev.map((ch) => ({ ...ch, power: 5 })))
  exchange(a, b)
  assert.deepEqual(listA.read(), [char('x', { damage: 2, power: 5 })])
  assert.deepEqual(listB.read(), listA.read())
})

test('two docs merge the Ready of each player in setup', () => {
  const a = new Y.Doc()
  const b = new Y.Doc()
  const setupA = createRecord(a.getMap('setup'), { depth: 1 })
  const setupB = createRecord(b.getMap('setup'), { depth: 1 })
  setupA.set({ ready: { blue: false, red: false } })
  exchange(a, b)
  setupA.set((prev) => ({ ...prev, ready: { ...prev.ready, blue: true } }))
  setupB.set((prev) => ({ ...prev, ready: { ...prev.ready, red: true } }))
  exchange(a, b)
  assert.deepEqual(setupA.read(), { ready: { blue: true, red: true } })
  assert.deepEqual(setupB.read(), setupA.read())
})

test('two docs sort entities with the same order the same way', () => {
  const a = new Y.Doc()
  const b = new Y.Doc()
  const listA = createList(a.getMap('characters'))
  const listB = createList(b.getMap('characters'))
  listA.set([char('m')])
  exchange(a, b)
  listA.set((prev) => [...prev, char('z')])
  listB.set((prev) => [...prev, char('b')])
  exchange(a, b)
  const ids = listA.read().map(({ id }) => id)
  assert.deepEqual(ids, ['m', 'b', 'z'])
  assert.deepEqual(
    listB.read().map(({ id }) => id),
    ids,
  )
})
