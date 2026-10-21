import type { Context } from 'hono'

// The answer with the bytes of a stored top view (the board, or the copy of a room). private, no-cache: the
// browser asks again each time, so a new image shows at once.
export function webpResponse(c: Context, image: Uint8Array): Response {
  return c.body(image as Uint8Array<ArrayBuffer>, 200, {
    'Content-Type': 'image/webp',
    'Cache-Control': 'private, no-cache',
  })
}
