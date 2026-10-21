// Stored terrain pieces of the table document. A module of its own, so rooms/table.js and terrain/builder.js
// both use it without importing each other.

import { MAPS } from './maps/index.js'

// The two kinds of stored terrain piece (docs/features/map-builder.md, "Board in the document"):
// a map piece { id, index, locked, y? }, the place in the map data, and a custom piece
// { id, piece, position, rotation, scale, size?, tint?, locked, y? }, a full placement. A map piece that the
// builder moves or turns becomes a custom piece. The stored piece has `piece` only when it is custom.
export const isCustomPiece = (stored) => stored.piece !== undefined

// The custom piece of a stored map piece, with the same id, lock and placement (the `y` of a fallen piece
// is in the position). mapId: the map of the table. A custom piece comes back as it is. null when the map
// data has no such placement.
export function toCustomPiece(mapId, stored) {
  if (isCustomPiece(stored)) return stored
  const placement = MAPS[mapId]?.placements[stored.index]
  if (!placement) return null
  const position =
    stored.y === undefined
      ? placement.position
      : [placement.position[0], stored.y, placement.position[2]]
  return { ...placement, position: [...position], id: stored.id, locked: stored.locked }
}
