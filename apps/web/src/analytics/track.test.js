import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTracker } from './track.js'

test('sends name and version, and kind only when given', () => {
  const sent = []
  const track = createTracker({ send: (body) => sent.push(body), version: 'v1' })
  track('app_open')
  track('room_create', 'solo')
  assert.deepEqual(sent, [
    { name: 'app_open', version: 'v1' },
    { name: 'room_create', version: 'v1', kind: 'solo' },
  ])
})

test('the version is cut to the server limit', () => {
  const sent = []
  const track = createTracker({ send: (body) => sent.push(body), version: 'x'.repeat(100) })
  track('app_open')
  assert.equal(sent[0].version.length, 64)
})

test('a throwing send does not throw', () => {
  const track = createTracker({
    send: () => {
      throw new Error('boom')
    },
  })
  assert.doesNotThrow(() => track('app_open'))
})

test('a rejected send does not throw or leave an unhandled rejection', async () => {
  let unhandled = false
  const onUnhandled = () => (unhandled = true)
  process.on('unhandledRejection', onUnhandled)
  const track = createTracker({ send: () => Promise.reject(new Error('offline')) })
  assert.doesNotThrow(() => track('app_open'))
  await new Promise((resolve) => setTimeout(resolve, 20))
  process.off('unhandledRejection', onUnhandled)
  assert.equal(unhandled, false)
})
