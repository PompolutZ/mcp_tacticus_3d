// The Sandbox board of the account (docs/features/map-builder.md). One function per route. Needs a login.

import { api, ApiError } from './client.js'

// The saved board (the map JSON format), or null when there is none
export async function getBoard() {
  try {
    return (await api('/me/board')).board
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

// board: the map object of the export (terrain/builder.js, exportBoard)
export async function saveBoard(board) {
  await api('/me/board', { method: 'PUT', json: board })
}
