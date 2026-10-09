import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import { linkedChannels } from './linkedChannels.js'
import { FRAME_SIZE, syncOverChannel } from './syncChannel.js'

const settle = () => new Promise((resolve) => setImmediate(resolve))

test('two documents end equal, both ways', async () => {
  const { a, b } = linkedChannels()
  const docA = new Y.Doc()
  const docB = new Y.Doc()
  docA.getMap('m').set('fromA', 1)
  docB.getMap('m').set('fromB', 2)
  syncOverChannel(docA, a)
  syncOverChannel(docB, b)
  await settle()
  assert.deepEqual(docA.getMap('m').toJSON(), docB.getMap('m').toJSON())
  assert.deepEqual(Y.encodeStateVector(docA), Y.encodeStateVector(docB))
  assert.deepEqual(docA.getMap('m').toJSON(), { fromA: 1, fromB: 2 })
})

test('sync starts when the channel opens', async () => {
  const { a, b, openBoth } = linkedChannels({ open: false })
  const docA = new Y.Doc()
  const docB = new Y.Doc()
  docA.getMap('m').set('k', 'v')
  syncOverChannel(docA, a)
  syncOverChannel(docB, b)
  assert.equal(a.sent.length, 0)
  openBoth()
  await settle()
  assert.equal(docB.getMap('m').get('k'), 'v')
})

test('a change after the first sync arrives, both ways', async () => {
  const { a, b } = linkedChannels()
  const docA = new Y.Doc()
  const docB = new Y.Doc()
  syncOverChannel(docA, a)
  syncOverChannel(docB, b)
  await settle()
  docA.getMap('m').set('late', 1)
  await settle()
  assert.equal(docB.getMap('m').get('late'), 1)
  docB.getMap('m').set('back', 2)
  await settle()
  assert.equal(docA.getMap('m').get('back'), 2)
})

test('a 100 KB update arrives in frames of at most 16 KB', async () => {
  const { a, b } = linkedChannels()
  const docA = new Y.Doc()
  const docB = new Y.Doc()
  syncOverChannel(docA, a)
  syncOverChannel(docB, b)
  await settle()
  a.sent.length = 0
  // Random text, so the update does not get smaller
  let text = ''
  for (let i = 0; i < 100_000; i++) text += String.fromCharCode(33 + Math.floor(Math.random() * 90))
  docA.getMap('m').set('big', text)
  await settle()
  assert.equal(docB.getMap('m').get('big'), text)
  assert.ok(a.sent.length >= 7)
  assert.ok(a.sent.every((frame) => frame.length <= FRAME_SIZE))
  const headers = a.sent.map((frame) => frame[0])
  assert.deepEqual(
    headers.slice(0, -1).filter((h) => h !== 1),
    [],
  )
  assert.equal(headers.at(-1), 2)
})

test('a small update is one whole frame', async () => {
  const { a, b } = linkedChannels()
  const docA = new Y.Doc()
  syncOverChannel(docA, a)
  syncOverChannel(new Y.Doc(), b)
  await settle()
  a.sent.length = 0
  docA.getMap('m').set('k', 1)
  assert.equal(a.sent.length, 1)
  assert.equal(a.sent[0][0], 0)
})

test('an update applied from the channel is not sent back', async () => {
  const { a, b } = linkedChannels()
  const docA = new Y.Doc()
  const docB = new Y.Doc()
  syncOverChannel(docA, a)
  syncOverChannel(docB, b)
  await settle()
  b.sent.length = 0
  docA.getMap('m').set('k', 1)
  await settle()
  assert.equal(docB.getMap('m').get('k'), 1)
  assert.equal(b.sent.length, 0)
})

test('stop ends the sync', async () => {
  const { a, b } = linkedChannels()
  const docA = new Y.Doc()
  const docB = new Y.Doc()
  const syncA = syncOverChannel(docA, a)
  syncOverChannel(docB, b)
  await settle()
  syncA.stop()
  docA.getMap('m').set('k', 1)
  await settle()
  assert.equal(docB.getMap('m').get('k'), undefined)
})

// Two documents with an awareness each, synced over linked channels
function pair(options) {
  const channels = linkedChannels(options)
  const docA = new Y.Doc()
  const docB = new Y.Doc()
  const awA = new Awareness(docA)
  const awB = new Awareness(docB)
  const syncA = syncOverChannel(docA, channels.a, awA)
  const syncB = syncOverChannel(docB, channels.b, awB)
  return { ...channels, docA, docB, awA, awB, syncA, syncB }
}

test('awareness states cross the channels, both ways', async () => {
  const { awA, awB } = pair()
  awA.setLocalStateField('owns', ['token:1'])
  awB.setLocalStateField('owns', ['loose:2'])
  await settle()
  assert.deepEqual(awB.getStates().get(awA.clientID), { owns: ['token:1'] })
  assert.deepEqual(awA.getStates().get(awB.clientID), { owns: ['loose:2'] })
  awA.destroy()
  awB.destroy()
})

test('the own state goes out when the channel opens', async () => {
  const { awA, awB, openBoth } = pair({ open: false })
  awA.setLocalStateField('owns', ['pile:1'])
  assert.equal(awB.getStates().has(awA.clientID), false)
  openBoth()
  await settle()
  assert.deepEqual(awB.getStates().get(awA.clientID), { owns: ['pile:1'] })
  awA.destroy()
  awB.destroy()
})

test('a renew of the same state is sent too', async () => {
  const { a, awA, awB } = pair()
  await settle()
  a.sent.length = 0
  awA.setLocalState(awA.getLocalState())
  assert.equal(a.sent.length, 1)
  assert.equal(a.sent[0][1], 1)
  awA.destroy()
  awB.destroy()
})

test('an awareness state applied from the channel is not sent back', async () => {
  const { b, awA, awB } = pair()
  await settle()
  b.sent.length = 0
  awA.setLocalStateField('owns', ['token:1'])
  await settle()
  assert.deepEqual(awB.getStates().get(awA.clientID), { owns: ['token:1'] })
  assert.equal(b.sent.length, 0)
  awA.destroy()
  awB.destroy()
})

test('stop removes the states that came from the channel', async () => {
  const { awA, awB, syncB } = pair()
  awA.setLocalStateField('owns', ['token:1'])
  await settle()
  assert.equal(awB.getStates().has(awA.clientID), true)
  syncB.stop()
  assert.equal(awB.getStates().has(awA.clientID), false)
  assert.equal(awB.getStates().has(awB.clientID), true)
  awA.destroy()
  awB.destroy()
})

test('after stop, awareness changes are not sent', async () => {
  const { a, awA, awB, syncA } = pair()
  await settle()
  syncA.stop()
  a.sent.length = 0
  awA.setLocalStateField('owns', ['token:1'])
  assert.equal(a.sent.length, 0)
  awA.destroy()
  awB.destroy()
})

test('a state comes again when a new channel opens after stop', async () => {
  const first = pair()
  first.awA.setLocalStateField('owns', ['token:1'])
  await settle()
  first.syncB.stop()
  first.syncA.stop()
  const again = linkedChannels()
  syncOverChannel(first.docA, again.a, first.awA)
  syncOverChannel(first.docB, again.b, first.awB)
  await settle()
  assert.deepEqual(first.awB.getStates().get(first.awA.clientID), { owns: ['token:1'] })
  first.awA.destroy()
  first.awB.destroy()
})
