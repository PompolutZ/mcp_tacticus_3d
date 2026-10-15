// Room records in localStorage, one key per room. The table of a room is a Yjs document in IndexedDB
// (rooms/tableDoc.js). See docs/features/rooms.md, "Storage". No React.

import { clearDocument } from 'y-indexeddb'
import { equal } from '../net/collections.js'
import { readJson as read, removeKey, storageKeys, writeJson as write } from '../storage.js'

// The colors before the roll off, the same as sideColorsOf of a new setup (setup/setup.js)
const START_COLORS = { host: 'blue', guest: 'red' }
const PREFIX = 'mcp-assist-3d/'
const ROOM_PREFIX = `${PREFIX}room/`
const USER_KEY = `${PREFIX}user`
// The record format. Version 3 keys the rosters by side, host / guest. An older record is not read: saved
// rooms are not migrated (docs/features/setup-game.md, "Colors"). Version 1 had the table in the record,
// version 2 had the rosters keyed blue / red.
export const VERSION = 3
// Crockford base32: no I, L, O, U, so a code read aloud or typed is not mistaken. 8 characters are 40 bits,
// the room code of docs/features/peer-to-peer.md, "Security and abuse".
const CODE_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

// The id of the user of this browser, made on the first call. The owner of the rooms it creates.
function userId() {
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

// Every room record of this browser, of any version, in key order. A record that is not an object has no
// id and is left out. Only the cleanup of stale rooms reads this.
export function listRawRoomRecords() {
  return storageKeys(ROOM_PREFIX).map((key) => ({ key, record: read(key) }))
}

// Every room of this browser, the last changed first
export function listRooms() {
  return listRawRoomRecords()
    .map(({ record }) => record)
    .filter((room) => room?.id && room.mapId && room.version === VERSION)
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

const SQUAD_PREFIX = `${PREFIX}squad/`
const MULTIPLAYER_PREFIX = `${PREFIX}multiplayer/`

// The key of the squad that a user chose in a multiplayer room. It stays in this browser until both players
// are Ready (docs/plans/implement-backend/08-two-browsers.md, decision 25).
const squadKey = (userId, code) => `${SQUAD_PREFIX}${userId}/${code}`

// The stored squad { setupId, squad: { characters, tactics } }, or null
export function readSquad(userId, code) {
  const record = read(squadKey(userId, code))
  return record?.squad ? record : null
}

// Returns false when the browser did not store it
export function saveSquad(userId, code, record) {
  return write(squadKey(userId, code), record)
}

export function deleteSquad(userId, code) {
  removeKey(squadKey(userId, code))
}

// The room codes of the stored squads of this user
export function listSquadCodes(userId) {
  const start = `${SQUAD_PREFIX}${userId}/`
  return storageKeys(start).map((key) => key.slice(start.length))
}

// Deletes an IndexedDB database with a table. IndexedDB can throw or fail when it is turned off. Then there
// is nothing to delete. The database of a multiplayer room also takes the squad of that room with it.
export function deleteDoc(name) {
  if (name.startsWith(MULTIPLAYER_PREFIX)) {
    const [userId, code] = name.slice(MULTIPLAYER_PREFIX.length).split('/')
    deleteSquad(userId, code)
  }
  try {
    clearDocument(name).catch(() => {})
  } catch {
    // See above
  }
}

// The room with this code, or null
export function openRoom(id) {
  const room = read(ROOM_PREFIX + id)
  return room?.id && room.mapId && room.version === VERSION ? room : null
}

// Creates and stores a room. rosters: { host: { code }, guest: null | { code } }, code: the MCT code of the
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
    colors: START_COLORS,
  }
  return write(ROOM_PREFIX + id, room) ? room : null
}

// Writes the map, the rosters and the side colors of the table of a room into its record, for the lobby tile.
// A record of a room that was not opened since colors came has none: the lobby shows no color. The table is the
// source, the record has a copy. changed: the table changed, so updatedAt changes too. Without a change, it
// writes only a different map or rosters, or an old version.
export function saveRoomRecord(id, { mapId, rosters, colors }, changed) {
  const room = read(ROOM_PREFIX + id)
  // Deleted in another tab
  if (!room) return
  const same =
    room.version === VERSION &&
    room.mapId === mapId &&
    equal(room.rosters, rosters) &&
    equal(room.colors, colors)
  if (same && !changed) return
  const { table: _oldTable, ...record } = room
  write(ROOM_PREFIX + id, {
    ...record,
    version: VERSION,
    mapId,
    rosters,
    colors,
    updatedAt: changed ? Date.now() : room.updatedAt,
  })
}

// Deletes the record and the table of a room
export function deleteRoom(id) {
  removeKey(ROOM_PREFIX + id)
  deleteDoc(roomDocName(id))
}

// True when the user of this browser created the room, so they can delete it
export function ownsRoom(room) {
  return room.owner === userId()
}
