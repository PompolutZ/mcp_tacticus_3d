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
export function mergeTables(stored: Uint8Array, update: Uint8Array): Uint8Array {
  return Y.mergeUpdates([stored, update])
}
