// The card of a room's map for the lobby and the join page: { src (asset key), name }. mapId null is a
// random multiplayer room whose guest has not joined yet: the card back and "Random map"
// (docs/features/rooms.md, "Lobby").
import { MAPS } from './maps/index.js'
import { MAP_CARD_BACK, mapCard } from './files.js'

const RANDOM_MAP_NAME = 'Random map'

export function mapFace(mapId) {
  if (mapId == null) return { src: MAP_CARD_BACK, name: RANDOM_MAP_NAME }
  return { src: mapCard(mapId), name: MAPS[mapId].name }
}
