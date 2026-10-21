// The "My board" card of the new room dialog (docs/features/map-builder.md, "Board in a new room"). Pure.

import { MAPS } from '../terrain/maps/index.js'
import { validateBoard } from '../terrain/builder.js'
import { MY_BOARD_NAME } from '../terrain/mapFace.js'
import { CUSTOM_MAP_ID } from './table.js'

// The maps of a random room and of the map carousel: the maps of the app. Never the board.
export const MAP_IDS = Object.keys(MAPS)

// The saved board of the account (the answer of getBoard: the map JSON, or null) -> { board (checked), name, author }, or
// null when there is none or the saved data is not a good board. name: the board name, else "My board". author: the author set by the server, or '' (old saved board).
export function myBoardChoice(saved) {
  if (!saved) return null
  const { board } = validateBoard(saved)
  return board
    ? { board, name: board.name.trim() || MY_BOARD_NAME, author: board.author.trim() }
    : null
}

// The ids of the carousel: the maps, then the board when there is one
export function carouselIds(choice) {
  return choice ? [...MAP_IDS, CUSTOM_MAP_ID] : MAP_IDS
}
