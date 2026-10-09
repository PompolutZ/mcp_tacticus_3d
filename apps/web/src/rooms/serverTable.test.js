import { test, mock, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { hasLocalChanges, watchServerTable } from './serverTable.js'

afterEach(() => mock.timers.reset())

const settle = () => new Promise((resolve) => setImmediate(resolve))
const fail = (status, message = 'x') => Object.assign(new Error(message), { status })

// A writer on a new doc with a put that records its calls. results: what each put does, in order (undefined
// resolves). A function result is called and awaited.
function setup(results = [], options = {}) {
  mock.timers.reset()
  mock.timers.enable({ apis: ['setTimeout'] })
  const doc = new Y.Doc()
  const calls = []
  const events = []
  const writer = watchServerTable({
    doc,
    put: async (bytes, opts) => {
      calls.push({ bytes, ...opts })
      const result = results[calls.length - 1]
      if (typeof result === 'function') await result()
      else if (result) throw result
    },
    onGone: () => events.push('gone'),
    onStop: (text) => events.push(`stop:${text}`),
    ...options,
  })
  const change = (value = 1) => doc.getMap('m').set('k', value)
  return { doc, calls, events, writer, change }
}

test('no write without a change', async () => {
  const { calls, writer } = setup()
  mock.timers.tick(120_000)
  writer.flush()
  await settle()
  assert.equal(calls.length, 0)
})

test('a change from the server does not start a write', async () => {
  const { doc, calls } = setup()
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(new Y.Doc()), 'server')
  const other = new Y.Doc()
  other.getMap('m').set('k', 1)
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(other), 'server')
  mock.timers.tick(120_000)
  await settle()
  assert.equal(calls.length, 0)
})

test('one write 60 s after the first change, not before', async () => {
  const { calls, change, doc } = setup()
  change(1)
  mock.timers.tick(59_999)
  await settle()
  assert.equal(calls.length, 0)
  // A second change does not move the timer
  change(2)
  mock.timers.tick(1)
  await settle()
  assert.equal(calls.length, 1)
  const copy = new Y.Doc()
  Y.applyUpdate(copy, calls[0].bytes)
  assert.equal(copy.getMap('m').get('k'), 2)
  assert.equal(calls[0].keepalive, false)
  mock.timers.tick(120_000)
  await settle()
  assert.equal(calls.length, 1)
  assert.equal(doc.getMap('m').get('k'), 2)
})

test('flush writes at once, and not again without a new change', async () => {
  const { calls, change, writer } = setup()
  change()
  writer.flush()
  await settle()
  assert.equal(calls.length, 1)
  writer.flush()
  mock.timers.tick(120_000)
  await settle()
  assert.equal(calls.length, 1)
})

test('a change during a write gives one more write later', async () => {
  let release
  const gate = () => new Promise((resolve) => (release = resolve))
  const { calls, change } = setup([gate])
  change(1)
  mock.timers.tick(60_000)
  await settle()
  assert.equal(calls.length, 1)
  change(2)
  mock.timers.tick(120_000)
  await settle()
  // Still one write at a time
  assert.equal(calls.length, 1)
  release()
  await settle()
  assert.equal(calls.length, 1)
  mock.timers.tick(59_999)
  await settle()
  assert.equal(calls.length, 1)
  mock.timers.tick(1)
  await settle()
  assert.equal(calls.length, 2)
})

test('a flush during a write writes when that write ends', async () => {
  let release
  const gate = () => new Promise((resolve) => (release = resolve))
  const { calls, change, writer } = setup([gate])
  change(1)
  writer.flush()
  change(2)
  writer.flush({ hidden: true })
  await settle()
  assert.equal(calls.length, 1)
  release()
  await settle()
  assert.equal(calls.length, 2)
  assert.equal(calls[1].keepalive, true)
})

test('a failure keeps the change and tries again after 60 s', async () => {
  for (const status of [0, 409, 500]) {
    const { calls, change, events } = setup([fail(status)])
    change()
    mock.timers.tick(60_000)
    await settle()
    assert.equal(calls.length, 1)
    mock.timers.tick(59_999)
    await settle()
    assert.equal(calls.length, 1)
    mock.timers.tick(1)
    await settle()
    assert.equal(calls.length, 2)
    assert.deepEqual(events, [])
    mock.timers.tick(120_000)
    await settle()
    assert.equal(calls.length, 2)
  }
})

test('404 calls onGone and ends the writer', async () => {
  const { calls, change, events } = setup([fail(404)])
  change()
  mock.timers.tick(60_000)
  await settle()
  assert.deepEqual(events, ['gone'])
  change(5)
  mock.timers.tick(120_000)
  await settle()
  assert.equal(calls.length, 1)
})

test('403 and 413 stop the writer and report the error', async () => {
  for (const [status, text] of [
    [403, 'No seat in this room'],
    [413, 'Table too large'],
  ]) {
    const { calls, change, events } = setup([fail(status, text)])
    change()
    mock.timers.tick(60_000)
    await settle()
    assert.deepEqual(events, [`stop:${text}`])
    change(5)
    mock.timers.tick(120_000)
    await settle()
    assert.equal(calls.length, 1)
  }
})

test('keepalive only when hidden and at most 60 KB', async () => {
  const { calls, change, writer, doc } = setup()
  change()
  writer.flush({ hidden: true })
  await settle()
  assert.equal(calls[0].keepalive, true)
  // A table of about 100 KB
  doc.getMap('m').set('big', 'x'.repeat(100_000))
  writer.flush({ hidden: true })
  await settle()
  assert.equal(calls[1].keepalive, false)
  assert.ok(calls[1].bytes.length > 60 * 1024)
  // Not hidden: no keepalive
  change(9)
  writer.flush()
  await settle()
  assert.equal(calls[2].keepalive, false)
})

test('an initial change is written by flush', async () => {
  const { calls, writer } = setup([], { changed: true })
  writer.flush()
  await settle()
  assert.equal(calls.length, 1)
})

test('stop ends the timer and the writes', async () => {
  const { calls, change, writer } = setup()
  change()
  writer.stop()
  mock.timers.tick(120_000)
  writer.flush()
  await settle()
  assert.equal(calls.length, 0)
})

test('hasLocalChanges: false for the same bytes', () => {
  const doc = new Y.Doc()
  doc.getMap('m').set('k', 1)
  doc.getArray('a').push([1, 2, 3])
  assert.equal(hasLocalChanges(doc, Y.encodeStateAsUpdate(doc)), false)
  const copy = new Y.Doc()
  Y.applyUpdate(copy, Y.encodeStateAsUpdate(doc))
  assert.equal(hasLocalChanges(copy, Y.encodeStateAsUpdate(doc)), false)
})

test('hasLocalChanges: true after a local insert', () => {
  const doc = new Y.Doc()
  doc.getArray('a').push([1])
  const server = Y.encodeStateAsUpdate(doc)
  doc.getArray('a').push([2])
  assert.equal(hasLocalChanges(doc, server), true)
})

test('hasLocalChanges: true after a local delete only', () => {
  const doc = new Y.Doc()
  doc.getArray('a').push([1, 2, 3])
  const server = Y.encodeStateAsUpdate(doc)
  const before = Y.encodeStateVector(doc)
  doc.getArray('a').delete(1, 1)
  // The state vector did not change, only the delete set
  assert.deepEqual(Y.encodeStateVector(doc), before)
  assert.equal(hasLocalChanges(doc, server), true)
})
