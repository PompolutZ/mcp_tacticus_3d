import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as Y from 'yjs'
import { tableFingerprint } from './fingerprint.js'

// Updates of two clients, each made on its own document
function updatesOf() {
  const a = new Y.Doc()
  a.clientID = 1
  const b = new Y.Doc()
  b.clientID = 2
  const out = []
  a.on('update', (u) => out.push(u))
  b.on('update', (u) => out.push(u))
  a.getMap('t').set('x', 1)
  b.getMap('t').set('y', 2)
  a.getMap('t').set('z', 3)
  return out
}

function apply(updates) {
  const doc = new Y.Doc()
  for (const u of updates) Y.applyUpdate(doc, u)
  return doc
}

test('8 lowercase hex characters', () => {
  assert.match(tableFingerprint(apply(updatesOf())), /^[0-9a-f]{8}$/)
})

test('the same updates in a different order give the same fingerprint', () => {
  const updates = updatesOf()
  assert.equal(tableFingerprint(apply(updates)), tableFingerprint(apply([...updates].reverse())))
})

test('a delete changes the fingerprint', () => {
  const doc = apply(updatesOf())
  const before = tableFingerprint(doc)
  doc.getMap('t').delete('x')
  assert.notEqual(tableFingerprint(doc), before)
})

test('different changes give different fingerprints', () => {
  const one = apply(updatesOf())
  const two = apply(updatesOf())
  two.getMap('t').set('w', 4)
  assert.notEqual(tableFingerprint(one), tableFingerprint(two))
})
