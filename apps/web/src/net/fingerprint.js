import * as Y from 'yjs'

// A short hash of the changes that a document holds (plan 11, decision 9). Two documents with the same
// changes have the same state vector and delete set, and Yjs writes both sorted. So the hash is the same.
// Plain function, no browser calls, so node --test can load it.
export function tableFingerprint(doc) {
  const bytes = Y.encodeSnapshot(Y.snapshot(doc))
  // FNV-1a, 32 bits
  let hash = 0x811c9dc5
  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
