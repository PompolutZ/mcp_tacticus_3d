// The Sandbox board of the account (docs/features/map-builder.md). One function per route. Needs a login.

import { api, ApiError, getBlob } from './client.js'
import { toBase64 } from '../rooms/base64.js'

// The saved board: { board (the map JSON format), hasImage }, or null when there is none
export async function getBoardInfo() {
  try {
    const { board, hasImage } = await api('/me/board')
    return { board, hasImage: hasImage === true }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

// The saved board (the map JSON format), or null when there is none
export async function getBoard() {
  return (await getBoardInfo())?.board ?? null
}

// board: the map object of the export (terrain/builder.js, exportBoard). image: the top view as a WebP Blob
// (terrain/boardImage.js), or none. Without an image, the account keeps no image.
export async function saveBoard(board, image) {
  const json = { ...board }
  if (image) json.image = toBase64(new Uint8Array(await image.arrayBuffer()))
  await api('/me/board', { method: 'PUT', json })
}

// The top view of the saved board as a WebP Blob, or null when there is none. The route needs the token.
export async function getBoardImage() {
  return getBlob('/me/board/image', 'image/webp')
}
