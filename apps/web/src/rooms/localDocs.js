// The IndexedDB copies of multiplayer rooms (plan 07, decision 12). No React.

import { deleteDoc } from './store.js'

// The user id has no '/', and a room code has none either, so a prefix match is exact
const prefix = (userId) => `mcp-assist-3d/multiplayer/${userId}/`

// The database names of this user's multiplayer rooms whose code is not in codes. Never a single player
// name, never another user's name.
export function staleDocNames(names, userId, codes) {
  const start = prefix(userId)
  const keep = new Set(codes)
  return names.filter((name) => name.startsWith(start) && !keep.has(name.slice(start.length)))
}

// Deletes the stale copies. A browser without indexedDB.databases() keeps them.
export async function deleteStaleDocs(userId, codes) {
  if (typeof indexedDB === 'undefined' || !indexedDB.databases) return
  try {
    const dbs = await indexedDB.databases()
    const names = dbs.map((db) => db.name).filter(Boolean)
    for (const name of staleDocNames(names, userId, codes)) deleteDoc(name)
  } catch {
    // The copies stay. The next list load tries again.
  }
}
