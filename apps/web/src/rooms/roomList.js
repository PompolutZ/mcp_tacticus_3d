// One list of the single player and the multiplayer rooms (docs/features/rooms.md, "Lobby"). No React.

import { isPlayableMap } from './table.js'
import { serverRoomBoard, singleRoomBoard } from './roomBoard.js'
import { TEAMS } from '../setup/setup.js'

// single: records of rooms/store.js (updatedAt in ms). multiplayer: rooms of the API (updatedAt is ISO).
// Returns { kind, id, mapId, board, rosters, colors, updatedAt (ms), room } (board: the card data of a room on the custom board, or null, rooms/roomBoard.js)
// (colors: { host, guest } of a single player room, undefined when unknown), the last changed first. A room of a map that
// the app does not have cannot open, so it is left out. A multiplayer room with mapId null (random, the
// guest has not joined) stays.
export function roomList(single, multiplayer) {
  const items = [
    ...single.map((room) => ({
      kind: 'single',
      id: room.id,
      mapId: room.mapId,
      board: singleRoomBoard(room),
      rosters: room.rosters,
      colors: room.colors,
      updatedAt: room.updatedAt,
      room,
    })),
    ...multiplayer.map((room) => ({
      kind: 'multiplayer',
      id: room.code,
      mapId: room.mapId,
      board: serverRoomBoard(room),
      rosters: room.rosters,
      updatedAt: Date.parse(room.updatedAt),
      room,
    })),
  ]
  return items
    .filter(
      (item) => (item.kind === 'multiplayer' && item.mapId === null) || isPlayableMap(item.mapId),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

const COLOR_LABEL = { blue: 'Blue', red: 'Red' }

// The roster links of a lobby tile (docs/features/rooms.md, "Lobby"): [{ team, color, label }] for each side
// that has a roster. Multiplayer: no color, the label is "<player name> roster". Single player: the color
// from the record (item.colors) and "Blue roster", or no color and "Roster 1" / "Roster 2" when the record
// has no colors.
export function rosterLinks(item) {
  return TEAMS.flatMap((team, i) => {
    if (!item.rosters?.[team]) return []
    if (item.kind === 'multiplayer') {
      const player = item.room.players?.[team]
      const name = player?.gone ? 'Deleted player' : player?.name
      return [{ team, color: null, label: `${name ?? 'Player'} roster` }]
    }
    const color = item.colors?.[team] ?? null
    return [{ team, color, label: color ? `${COLOR_LABEL[color]} roster` : `Roster ${i + 1}` }]
  })
}
