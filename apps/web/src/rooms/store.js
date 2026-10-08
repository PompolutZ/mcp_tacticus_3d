// Rooms in localStorage, one key per room. See docs/feature-rooms.md, "Storage". No React.

const PREFIX = 'mcp-assist-3d/'
const ROOM_PREFIX = `${PREFIX}room/`
const USER_KEY = `${PREFIX}user`
// The record format. A record with another version opens with an empty table (see openRoom).
const VERSION = 1
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
  const chars = [...bytes].map(b => CODE_CHARS[b % CODE_CHARS.length])
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
    .filter(key => key?.startsWith(ROOM_PREFIX))
    .map(read)
    .filter(room => room?.id && room.mapId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

// The room with this code, or null. A record of another version keeps its setup, but its table is
// left out, because its fields may have other shapes.
export function openRoom(id) {
  const room = read(ROOM_PREFIX + id)
  if (!room?.id || !room.mapId) return null
  return room.version === VERSION ? room : { ...room, table: null }
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
    table: null,
  }
  return write(ROOM_PREFIX + id, room) ? room : null
}

// Room code → the JSON of the last stored rosters and table, so saveRoom writes only a change
const lastSaved = new Map()

// Stores the rosters and the table of a room. Writes only when they changed since the last save of
// this page, and only then sets updatedAt. Returns false when the browser did not store it.
export function saveRoom(room, rosters, table) {
  const text = JSON.stringify({ rosters, table })
  if (lastSaved.get(room.id) === text) return true
  const saved = write(ROOM_PREFIX + room.id, { ...room, version: VERSION, updatedAt: Date.now(), rosters, table })
  if (saved) lastSaved.set(room.id, text)
  return saved
}

export function deleteRoom(id) {
  try {
    localStorage.removeItem(ROOM_PREFIX + id)
  } catch {
    // Storage turned off: there is nothing to delete
  }
  lastSaved.delete(id)
}

// True when the user of this browser created the room, so they can delete it
export function ownsRoom(room) {
  return room.owner === userId()
}
