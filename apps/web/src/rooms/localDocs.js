// The IndexedDB copies of multiplayer rooms (docs/features/rooms.md, "Storage") and the stored squads of this browser. No React.

import {
  VERSION,
  deleteDoc,
  deleteRoom,
  deleteSquad,
  listRawRoomRecords,
  listSquadCodes,
} from './store.js'
import { deleteOrphanRoomImages } from './roomImage.js'

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

// The codes in stored whose room is not in codes
export function staleSquadCodes(stored, codes) {
  const keep = new Set(codes)
  return stored.filter((code) => !keep.has(code))
}

// Deletes the stored squads of this user whose room is gone
export function deleteStaleSquads(userId, codes) {
  for (const code of staleSquadCodes(listSquadCodes(userId), codes)) deleteSquad(userId, code)
}

// Deletes all multiplayer data of one user in this browser: the copies and the squads (Delete account)
export async function deleteUserData(userId) {
  deleteStaleSquads(userId, [])
  await deleteStaleDocs(userId, [])
}

const ROOM_DOC_PREFIX = 'mcp-assist-3d/room/'

// The ids of the records with no version or an older one than version. A newer one stays: another tab runs a
// newer build (docs/features/rooms.md, "Storage").
export function staleRoomIds(records, version) {
  return records
    .filter((room) => room?.id && !(Number.isInteger(room.version) && room.version >= version))
    .map((room) => room.id)
}

// The single player database names whose id is not in ids. Never a multiplayer name or another prefix.
export function orphanRoomDocNames(names, ids) {
  const keep = new Set(ids)
  return names.filter(
    (name) => name.startsWith(ROOM_DOC_PREFIX) && !keep.has(name.slice(ROOM_DOC_PREFIX.length)),
  )
}

// Deletes the single player rooms that this build cannot list or open, and the databases that have no
// record. A browser without indexedDB.databases() keeps the databases.
export async function deleteStaleRooms() {
  const records = listRawRoomRecords().map(({ record }) => record)
  for (const id of staleRoomIds(records, VERSION)) deleteRoom(id)
  await deleteOrphanRoomImages(
    listRawRoomRecords().flatMap(({ record }) => (record?.id ? [record.id] : [])),
  )
  if (typeof indexedDB === 'undefined' || !indexedDB.databases) return
  try {
    const dbs = await indexedDB.databases()
    const names = dbs.map((db) => db.name).filter(Boolean)
    // Read the records again: the ids that are left (version VERSION or newer) are in use
    const ids = listRawRoomRecords().flatMap(({ record }) => (record?.id ? [record.id] : []))
    for (const name of orphanRoomDocNames(names, ids)) deleteDoc(name)
  } catch {
    // The databases stay. The next lobby tries again.
  }
}
