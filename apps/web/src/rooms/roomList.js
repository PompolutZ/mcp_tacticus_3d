// One list of the single player and the multiplayer rooms (plan 07, decision 18). No React.

import { MAPS } from '../terrain/maps.js'

// single: records of rooms/store.js (updatedAt in ms). multiplayer: rooms of the API (updatedAt is ISO).
// Returns { kind, id, mapId, rosters, updatedAt (ms), room }, the last changed first. A room of a map that
// the app does not have cannot open, so it is left out.
export function roomList(single, multiplayer) {
  const items = [
    ...single.map((room) => ({
      kind: 'single',
      id: room.id,
      mapId: room.mapId,
      rosters: room.rosters,
      updatedAt: room.updatedAt,
      room,
    })),
    ...multiplayer.map((room) => ({
      kind: 'multiplayer',
      id: room.code,
      mapId: room.mapId,
      rosters: room.rosters,
      updatedAt: Date.parse(room.updatedAt),
      room,
    })),
  ]
  return items.filter((item) => MAPS[item.mapId]).sort((a, b) => b.updatedAt - a.updatedAt)
}
