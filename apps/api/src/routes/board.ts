import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import * as z from 'zod/mini'
import type { Config } from '../config'
import { requireUser, type AuthEnv } from '../middleware/user'
import { validate } from '../middleware/validate'
import type { Board, BoardPlacement, Store } from '../stores/store'

// 300 pieces with long numbers stay far below this.
const MAX_BODY = 128 * 1024
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

// The board of the Sandbox builder (docs/features/map-builder.md), one per user.
export function boardRoutes(deps: { store: Store; config: Config }) {
  const { store } = deps
  const app = new Hono<AuthEnv>()
  app.use('/me/board', requireUser(deps))

  app.get('/me/board', async (c) => {
    const doc = await store.boards.get(c.get('user')._id)
    if (!doc) return c.json({ error: 'No board' }, 404)
    return c.json({ board: doc.board, updatedAt: doc.updatedAt.toISOString() })
  })

  app.put(
    '/me/board',
    bodyLimit({
      maxSize: MAX_BODY,
      onError: (c) => c.json({ error: 'Board too large' }, 413),
    }),
    validate(boardSchema),
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
      await store.boards.put(c.get('user')._id, board, new Date())
      return c.body(null, 204)
    },
  )
  return app
}
