// The multiplayer rooms API (plan 07, "Names"). One function per route. The only caller of api() for rooms.

import { api } from '../api/client.js'
import { toBase64 } from './base64.js'

const path = (code) => `/rooms/${encodeURIComponent(code)}`

// The rooms where the user has a seat, the last changed first
export async function listRooms() {
  return (await api('/rooms')).rooms
}

export async function getRoom(code) {
  return (await api(path(code))).room
}

// side: 'blue' | 'red'. roster: { code }. table: the bytes of the start table.
export async function createRoom({ mapId, side, roster, table }) {
  const json = { mapId, side, roster, table: toBase64(table) }
  return (await api('/rooms', { method: 'POST', json })).room
}

export async function joinRoom(code, roster) {
  return (await api(`${path(code)}/join`, { method: 'POST', json: { roster } })).room
}

export async function deleteRoom(code) {
  await api(path(code), { method: 'DELETE' })
}

// The bytes of the table
export function getTable(code, { keepalive } = {}) {
  return api(`${path(code)}/table`, { binary: true, keepalive })
}

export async function putTable(code, bytes, { keepalive } = {}) {
  await api(`${path(code)}/table`, { method: 'PUT', bytes, keepalive })
}
