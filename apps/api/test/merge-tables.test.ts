import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { mergeTables } from '../src/rooms/table'

function writes(count: number, every: number) {
  const client = new Y.Doc()
  const updates: Uint8Array[] = []
  client.on('update', (u: Uint8Array) => updates.push(u))
  const map = client.getMap('poses')
  for (let i = 0; i < count; i++) map.set(`k${i % 30}`, [i, i + 1, i + 2, i + 3])
  return { client, updates, every }
}

function content(doc: Y.Doc) {
  return doc.getMap('poses').toJSON()
}

describe('mergeTables', () => {
  it('is smaller than mergeUpdates and keeps the content', () => {
    const { client, updates, every } = writes(3000, 50)
    let compact: Uint8Array = Y.encodeStateAsUpdate(new Y.Doc())
    let plain: Uint8Array = compact
    for (let i = 0; i < updates.length; i += every) {
      const batch = Y.mergeUpdates(updates.slice(i, i + every))
      compact = mergeTables(compact, batch)
      plain = Y.mergeUpdates([plain, batch])
    }
    expect(compact.length).toBeLessThan(plain.length)
    const doc = new Y.Doc()
    Y.applyUpdate(doc, compact)
    expect(content(doc)).toEqual(content(client))
  })

  it('makes a table stored by mergeUpdates compact', () => {
    const { client, updates } = writes(2000, 1)
    const stored = Y.mergeUpdates(updates)
    const merged = mergeTables(stored, Y.encodeStateAsUpdate(new Y.Doc()))
    expect(merged.length).toBeLessThan(stored.length)
    const doc = new Y.Doc()
    Y.applyUpdate(doc, merged)
    expect(content(doc)).toEqual(content(client))
  })
})
