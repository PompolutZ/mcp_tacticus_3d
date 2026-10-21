import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import * as z from 'zod/mini'
import type { Config } from '../config'
import { requireUser, type AuthEnv } from '../middleware/user'
import { validate } from '../middleware/validate'
import type { Board, BoardPlacement, Store } from '../stores/store'

// The image is a top view of the mat, 512 x 512 WebP. The limit is on the decoded bytes.
const MAX_IMAGE = 150 * 1024
// 300 pieces with long numbers stay far below 128 KB. The body also holds the image as base64 (4 bytes for 3).
const MAX_BODY = 128 * 1024 + Math.ceil(MAX_IMAGE / 3) * 4
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/
const MAX_PLACEMENTS = 300

const text = (max: number) => z.string().check(z.maxLength(max))
const num = z.number()
const vec3 = z.tuple([num, num, num])
const unit = z.number().check(z.gte(0), z.lte(1))

const placementSchema = z.object({
  piece: z.string().check(z.regex(/^[a-z0-9-]{1,80}$/)),
  position: vec3,
  rotation: vec3,
  scale: z.union([num, vec3]),
  size: z.optional(z.int().check(z.gte(1), z.lte(5))),
  tint: z.optional(z.tuple([unit, unit, unit])),
})

const boardSchema = z.object({
  id: z.optional(text(80)),
  name: z.optional(text(80)),
  mat: z.string().check(z.minLength(1), z.maxLength(80)),
  matRotation: num,
  placements: z.array(placementSchema).check(z.maxLength(MAX_PLACEMENTS)),
})

// The body of PUT: the board and the optional image (base64)
const bodySchema = z.object({
  ...boardSchema.shape,
  image: z.optional(z.string().check(z.regex(BASE64))),
})

// A WebP file starts with RIFF, 4 bytes of size, and WEBP
function isWebp(bytes: Uint8Array): boolean {
  const at = (offset: number, text: string) =>
    [...text].every((ch, i) => bytes[offset + i] === ch.charCodeAt(0))
  return bytes.length >= 12 && at(0, 'RIFF') && at(8, 'WEBP')
}

// The board of the Sandbox builder (docs/features/map-builder.md), one per user.
export function boardRoutes(deps: { store: Store; config: Config }) {
  const { store } = deps
  const app = new Hono<AuthEnv>()
  app.use('/me/board', requireUser(deps))
  app.use('/me/board/image', requireUser(deps))

  app.get('/me/board', async (c) => {
    const doc = await store.boards.get(c.get('user')._id)
    if (!doc) return c.json({ error: 'No board' }, 404)
    return c.json({
      board: doc.board,
      updatedAt: doc.updatedAt.toISOString(),
      hasImage: doc.hasImage,
    })
  })

  // The bytes of the top view. private, no-cache: the browser asks again, the image is the user's own.
  app.get('/me/board/image', async (c) => {
    const image = await store.boards.getImage(c.get('user')._id)
    if (!image) return c.json({ error: 'No image' }, 404)
    return c.body(image as Uint8Array<ArrayBuffer>, 200, {
      'Content-Type': 'image/webp',
      'Cache-Control': 'private, no-cache',
    })
  })

  app.put(
    '/me/board',
    bodyLimit({
      maxSize: MAX_BODY,
      onError: (c) => c.json({ error: 'Board too large' }, 413),
    }),
    validate(bodySchema),
    async (c) => {
      const body = c.req.valid('json')
      // Field by field: the body itself never goes to the store.
      const board: Board = {
        mat: body.mat,
        matRotation: body.matRotation,
        placements: body.placements.map((p): BoardPlacement => {
          const out: BoardPlacement = {
            piece: p.piece,
            position: [...p.position],
            rotation: [...p.rotation],
            scale: typeof p.scale === 'number' ? p.scale : [...p.scale],
          }
          if (p.size !== undefined) out.size = p.size
          if (p.tint !== undefined) out.tint = [...p.tint]
          return out
        }),
      }
      if (body.id !== undefined) board.id = body.id
      if (body.name !== undefined) board.name = body.name
      board.author = c.get('user').name
      let image: Uint8Array | undefined
      if (body.image !== undefined) {
        image = new Uint8Array(Buffer.from(body.image, 'base64'))
        if (image.length > MAX_IMAGE) return c.json({ error: 'Image too large' }, 413)
        if (!isWebp(image)) return c.json({ error: 'Image must be WebP' }, 400)
      }
      await store.boards.put(c.get('user')._id, board, new Date(), image)
      return c.body(null, 204)
    },
  )
  return app
}
