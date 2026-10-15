import * as Y from 'yjs'

// A table body from a client is untrusted. Decoding is the cheapest check.
export function isYjsUpdate(bytes: Uint8Array): boolean {
  try {
    Y.decodeUpdate(bytes)
    return true
  } catch {
    return false
  }
}

// Merges a client update into the stored table. Yjs updates merge in any order.
// The result is a compact document: Y.mergeUpdates keeps the content of deleted
// items, a Y.Doc (gc on) drops it. A table stored before this becomes compact
// on its next write.
export function mergeTables(stored: Uint8Array, update: Uint8Array): Uint8Array {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, stored)
  Y.applyUpdate(doc, update)
  const merged = Y.encodeStateAsUpdate(doc)
  doc.destroy()
  return merged
}
