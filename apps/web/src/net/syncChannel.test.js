import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { FRAME_SIZE, syncOverChannel } from './syncChannel.js'

const settle = () => new Promise((resolve) => setImmediate(resolve))

// Two linked fake channels. A frame sent on one arrives on the other, as an ArrayBuffer.
function linkedChannels({ open = true } = {}) {
  const make = () => {
    const ch = new EventTarget()
    ch.readyState = open ? 'open' : 'connecting'
    ch.sent = []
    return ch
  }
  const a = make()
  const b = make()
  const wire = (from, to) => {
    from.send = (frame) => {
      from.sent.push(frame)
      const copy = frame.slice().buffer
      queueMicrotask(() => {
        const event = new Event('message')
        event.data = copy
        to.dispatchEvent(event)
      })
    }
  }
  wire(a, b)
  wire(b, a)
  const openBoth = () => {
    for (const ch of [a, b]) {
      ch.readyState = 'open'
      ch.dispatchEvent(new Event('open'))
    }
  }
  return { a, b, openBoth }
}

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
