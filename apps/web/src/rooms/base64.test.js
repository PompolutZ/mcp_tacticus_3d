import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fromBase64, toBase64 } from './base64.js'

test('bytes survive a round trip', () => {
  const bytes = Uint8Array.from([0, 1, 2, 127, 128, 254, 255])
  assert.equal(toBase64(bytes), Buffer.from(bytes).toString('base64'))
  assert.deepEqual(fromBase64(toBase64(bytes)), bytes)
})

test('empty bytes give an empty text', () => {
  assert.equal(toBase64(new Uint8Array(0)), '')
  assert.deepEqual(fromBase64(''), new Uint8Array(0))
})

test('100 KB survive a round trip', () => {
  const bytes = new Uint8Array(100_000).map((_, i) => (i * 31) % 256)
  assert.deepEqual(fromBase64(toBase64(bytes)), bytes)
})
