// Room records in localStorage, one key per room. The table of a room is a Yjs document in IndexedDB
// (rooms/tableDoc.js). See docs/feature-rooms.md, "Storage". No React.

import { clearDocument } from 'y-indexeddb'
import { equal } from '../net/collections.js'

const PREFIX = 'mcp-assist-3d/'
const ROOM_PREFIX = `${PREFIX}room/`
const USER_KEY = `${PREFIX}user`
// The record format. Version 1 had the table in the record. Its table is not read, so the room opens with a
// new table (docs/plans/implement-backend/05-yjs-state.md, decision 12).
const VERSION = 2
// Crockford base32: no I, L, O, U, so a code read aloud or typed is not mistaken. 8 characters are 40 bits,
// the room code of docs/feature-peer-to-peer.md, "Security and abuse".
const CODE_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

// localStorage can throw: storage turned off, or full. A read then finds nothing.
function read(key) {
  try {
    const text = localStorage.getItem(key)
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

// Returns false when the browser did not store it
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

// The id of the user of this browser, made on the first call. The owner of the rooms it creates.
export function userId() {
  const user = read(USER_KEY)
  if (user?.id) return user.id
  const id = crypto.randomUUID()
  write(USER_KEY, { id })
  return id
}

// A new room code, for example K7Q2-M9XD
function newRoomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const chars = [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length])
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
}

// Every room of this browser, the last changed first
export function listRooms() {
  let keys = []
  try {
    keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
  } catch {
    // Storage turned off: no rooms
  }
  return keys
    .filter((key) => key?.startsWith(ROOM_PREFIX))
    .map(read)
    .filter((room) => room?.id && room.mapId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

// The name of the IndexedDB database with the table of a single player room
export function roomDocName(id) {
  return ROOM_PREFIX + id
}

// The name of the database of a multiplayer room. The user id keeps two users of one browser apart.
export function multiplayerDocName(userId, code) {
  return `${PREFIX}multiplayer/${userId}/${code}`
}

// Deletes an IndexedDB database with a table. IndexedDB can throw or fail when it is turned off. Then there
// is nothing to delete.
export function deleteDoc(name) {
  try {
    clearDocument(name).catch(() => {})
  } catch {
    // See above
  }
}

// The room with this code, or null
export function openRoom(id) {
  const room = read(ROOM_PREFIX + id)
  return room?.id && room.mapId ? room : null
}

// Creates and stores a room. rosters: { blue: { code }, red: null | { code } }, code: the MCT code of the
// roster (rosters/mct.js, formatMctCode). Returns the room, or null when the browser did not store it.
export function createRoom(mapId, rosters) {
  let id = newRoomCode()
  while (read(ROOM_PREFIX + id)) id = newRoomCode()
  const now = Date.now()
  const room = {
    version: VERSION,
    id,
    owner: userId(),
    createdAt: now,
    updatedAt: now,
    mapId,
    rosters,
  }
  return write(ROOM_PREFIX + id, room) ? room : null
}

// Writes the map and the rosters of the table of a room into its record, for the lobby tile. The table is the
// source, the record has a copy. changed: the table changed, so updatedAt changes too. Without a change, it
// writes only a different map or rosters, or an old version.
export function saveRoomRecord(id, { mapId, rosters }, changed) {
  const room = read(ROOM_PREFIX + id)
  // Deleted in another tab
  if (!room) return
  const same = room.version === VERSION && room.mapId === mapId && equal(room.rosters, rosters)
  if (same && !changed) return
  const { table: _oldTable, ...record } = room
  write(ROOM_PREFIX + id, {
    ...record,
    version: VERSION,
    mapId,
    rosters,
    updatedAt: changed ? Date.now() : room.updatedAt,
  })
}

// Deletes the record and the table of a room
export function deleteRoom(id) {
  try {
    localStorage.removeItem(ROOM_PREFIX + id)
  } catch {
    // Storage turned off: there is nothing to delete
  }
  deleteDoc(roomDocName(id))
}

// True when the user of this browser created the room, so they can delete it
export function ownsRoom(room) {
  return room.owner === userId()
}
