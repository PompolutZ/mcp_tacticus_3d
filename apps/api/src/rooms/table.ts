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
