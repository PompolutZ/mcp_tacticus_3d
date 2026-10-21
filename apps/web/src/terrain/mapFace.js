// The card of a room's map for the lobby and the join page: { src (asset key), name }. mapId null is a
// random multiplayer room whose guest has not joined yet: the card back and "Random map". mapId 'custom': the card back and "My board"
// (docs/features/rooms.md, "Lobby").
import { MAPS } from './maps/index.js'
import { CUSTOM_MAP_ID } from '../rooms/table.js'
import { MAP_CARD_BACK, mapCard } from './files.js'

const RANDOM_MAP_NAME = 'Random map'
// The board of the host, copied into the room (rooms/table.js, CUSTOM_MAP_ID). The room has no name of it.
export const MY_BOARD_NAME = 'My board'

export function mapFace(mapId) {
  if (mapId == null) return { src: MAP_CARD_BACK, name: RANDOM_MAP_NAME }
  if (mapId === CUSTOM_MAP_ID) return { src: MAP_CARD_BACK, name: MY_BOARD_NAME }
  return { src: mapCard(mapId), name: MAPS[mapId].name }
}
