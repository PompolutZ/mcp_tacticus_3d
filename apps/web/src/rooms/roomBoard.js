// The board card data of a room on the custom board (docs/features/map-builder.md, "Board in a new room"). Pure.
// Both return { name, author, hasImage }, or null for a room on another map. name: "My board" when the copy has none.

import { MY_BOARD_NAME } from '../terrain/mapFace.js'
import { CUSTOM_MAP_ID } from './table.js'

// room: a record of rooms/store.js. The record holds the board (name, author); the image is in IndexedDB
// (rooms/roomImage.js), so it is tried for every room on the board.
export function singleRoomBoard(room) {
  if (room.mapId !== CUSTOM_MAP_ID) return null
  return {
    name: room.board?.name?.trim() || MY_BOARD_NAME,
    author: room.board?.author?.trim() ?? '',
    hasImage: true,
  }
}

// room: the API room (boardName, boardAuthor, hasImage)
export function serverRoomBoard(room) {
  if (room.mapId !== CUSTOM_MAP_ID) return null
  return {
    name: room.boardName?.trim() || MY_BOARD_NAME,
    author: room.boardAuthor?.trim() ?? '',
    hasImage: room.hasImage === true,
  }
}
