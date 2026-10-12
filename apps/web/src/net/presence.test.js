import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import { linkedChannels } from './linkedChannels.js'
import { syncOverChannel } from './syncChannel.js'
import { createOwnership } from './ownership.js'
import { createPresence } from './presence.js'

const settle = () => new Promise((resolve) => setImmediate(resolve))

function players() {
  const channels = linkedChannels({ open: true })
  const docA = new Y.Doc()
  const docB = new Y.Doc()
  const awA = new Awareness(docA)
  const awB = new Awareness(docB)
  syncOverChannel(docA, channels.a, awA)
  syncOverChannel(docB, channels.b, awB)
  return {
    awA,
    awB,
    a: createPresence({ awareness: awA }),
    b: createPresence({ awareness: awB }),
    end() {
      awA.destroy()
      awB.destroy()
    },
  }
}

test('the other player gets selection, tools and mark', async () => {
  const p = players()
  await settle()
  assert.deepEqual(p.b.other(), { selection: [], tools: [], mark: null, ping: null })
  p.a.set({
    selection: ['character:m1', 'token:t1'],
    tools: ['range'],
    mark: { key: 'character:m2', mode: 'inRange' },
  })
  await settle()
  assert.deepEqual(p.b.other(), {
    selection: ['character:m1', 'token:t1'],
    tools: ['range'],
    mark: { key: 'character:m2', mode: 'inRange' },
    ping: null,
  })
  // The own fields are not the other's
  assert.deepEqual(p.a.other().selection, [])
  p.end()
})

test('other() is the same object until a field changes', async () => {
  const p = players()
  p.a.set({ selection: ['character:m1'] })
  await settle()
  const first = p.b.other()
  let calls = 0
  p.b.subscribe(() => calls++)
  p.a.set({ selection: ['character:m1'] })
  p.a.set({ tools: [] })
  await settle()
  assert.equal(p.b.other(), first)
  assert.equal(calls, 0)
  p.a.set({ mark: { key: 'token:t1', mode: 'outOfRange' } })
  await settle()
  assert.notEqual(p.b.other(), first)
  assert.equal(calls, 1)
  p.a.set({ mark: null })
  await settle()
  assert.equal(p.b.other().mark, null)
  assert.equal(calls, 2)
  p.end()
})

test('a ping reaches the other player, a new id replaces it', async () => {
  const p = players()
  await settle()
  const ping = { id: 'a', at: [1, 0.5, -2] }
  p.a.set({ ping })
  await settle()
  assert.deepEqual(p.b.other().ping, ping)
  assert.equal(p.a.other().ping, null)
  const first = p.b.other()
  p.a.set({ ping: { ...ping } })
  await settle()
  assert.equal(p.b.other(), first)
  p.a.set({ ping: { id: 'b', at: [3, 0, 4] } })
  await settle()
  assert.equal(p.b.other().ping.id, 'b')
  p.a.set({ ping: { id: 'c', at: [1, 2] } })
  await settle()
  assert.equal(p.b.other().ping, null)
  p.end()
})

test('the ping in the first state shows nothing, a new id shows, the same id again does not', async () => {
  const channels = linkedChannels({ open: true })
  const docA = new Y.Doc()
  const docB = new Y.Doc()
  const awA = new Awareness(docA)
  const awB = new Awareness(docB)
  const a = createPresence({ awareness: awA })
  a.set({ ping: { id: 'old', at: [1, 0, 1] } })
  const b = createPresence({ awareness: awB })
  syncOverChannel(docA, channels.a, awA)
  syncOverChannel(docB, channels.b, awB)
  await settle()
  assert.equal(b.other().ping, null)
  // Awareness sends the state again
  awA.setLocalStateField('tools', ['range'])
  await settle()
  assert.equal(b.other().ping, null)
  a.set({ ping: { id: 'new', at: [2, 0, 2] } })
  await settle()
  assert.equal(b.other().ping.id, 'new')
  awA.destroy()
  awB.destroy()
})

test('a client that left and came back with an old ping shows nothing', async () => {
  const p = players()
  await settle()
  p.a.set({ ping: { id: 'p1', at: [1, 0, 1] } })
  await settle()
  assert.equal(p.b.other().ping.id, 'p1')
  const state = p.awA.getLocalState()
  p.awA.setLocalState(null)
  await settle()
  assert.equal(p.b.other().ping, null)
  p.awA.setLocalState(state)
  await settle()
  assert.equal(p.b.other().ping, null)
  p.a.set({ ping: { id: 'p2', at: [2, 0, 2] } })
  await settle()
  assert.equal(p.b.other().ping.id, 'p2')
  p.end()
})

test('a player who left shows nothing', async () => {
  const p = players()
  p.a.set({ selection: ['character:m1'] })
  await settle()
  assert.deepEqual(p.b.other().selection, ['character:m1'])
  p.awA.setLocalState(null)
  await settle()
  assert.deepEqual(p.b.other().selection, [])
  p.end()
})

test('presence and ownership share the awareness state', async () => {
  const p = players()
  const ownA = createOwnership({ awareness: p.awA, role: 'host' })
  const ownB = createOwnership({ awareness: p.awB, role: 'guest' })
  ownA.claim('token:1')
  p.a.set({ selection: ['token:1'] })
  ownA.setDrag('character:m1')
  p.a.set({ mark: { key: 'character:m2', mode: 'inRange' } })
  await settle()
  assert.equal(ownB.owner('token:1'), 'other')
  assert.equal(ownB.otherDrag(), 'character:m1')
  assert.deepEqual(p.b.other().selection, ['token:1'])
  assert.deepEqual(p.b.other().mark, { key: 'character:m2', mode: 'inRange' })
  assert.deepEqual(ownA.mine(), ['token:1'])
  ownA.release('token:1')
  await settle()
  assert.deepEqual(p.b.other().selection, ['token:1'])
  assert.equal(ownB.owner('token:1'), null)
  ownA.destroy()
  ownB.destroy()
  p.end()
})

test('the local version does nothing', () => {
  const p = createPresence()
  p.set({ selection: ['character:m1'] })
  assert.deepEqual(p.other(), { selection: [], tools: [], mark: null, ping: null })
  assert.equal(p.other(), p.other())
  p.subscribe(() => {})()
  p.destroy()
})
