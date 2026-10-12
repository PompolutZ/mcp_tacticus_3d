import { randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import * as z from 'zod/mini'
import { requireSession, type SessionEnv } from '../middleware/session'
import type { SeatCache } from '../rooms/seats'
import type { Config } from '../config'
import type { MessageDoc, Store } from '../stores/store'

const MAX_BODY = 16 * 1024
const MAX_DATA = 8 * 1024
const MAX_IN_ROOM = 50
const POLL_LIMIT = 50
const HOUR_MS = 60 * 60 * 1000

const PEER_RE = /^[A-Za-z0-9_-]{8,64}$/
const MESSAGE_ID_RE = /^\d{13}-[A-Za-z0-9_-]{8}$/

// 13 digits of the time in ms, so ids sort by time, and 8 random characters.
export function newMessageId(now: number = Date.now()): string {
  return `${String(now).padStart(13, '0')}-${randomBytes(6).toString('base64url')}`
}

export function isMessageId(text: string): boolean {
  return MESSAGE_ID_RE.test(text)
}

const peer = z.string().check(z.regex(PEER_RE))
const messageSchema = z.object({
  from: peer,
  to: z.union([peer, z.literal('*')]),
  type: z.enum(['hello', 'offer', 'answer', 'bye']),
  data: z.string().check(z.maxLength(MAX_DATA)),
})

const err = (status: 400 | 401 | 403 | 404 | 429, message: string) =>
  new HTTPException(status, { message })

export function signalRoutes(deps: { store: Store; config: Config; seats: SeatCache }) {
  const { store, seats } = deps
  const session = requireSession(deps)
  const app = new Hono<SessionEnv>()

  // 404 for an unknown room, 403 for a user with no seat. Reads no user.
  async function seated(code: string, userId: string): Promise<string> {
    const s = await seats.seats(code, userId)
    if (!s) throw err(404, 'Room not found')
    if (s.host !== userId && s.guest !== userId) throw err(403, 'No seat in this room')
    return code
  }

  app.post(
    '/rooms/:code/messages',
    session,
    bodyLimit({
      maxSize: MAX_BODY,
      onError: (c) => c.json({ error: 'Message too large' }, 413),
    }),
    async (c) => {
      const room = await seated(c.req.param('code'), c.get('userId'))
      const parsed = messageSchema.safeParse(await c.req.json().catch(() => null))
      // A `user` field in the body is not in the schema, so it is dropped.
      if (!parsed.success) throw err(400, 'Invalid message')
      const body = parsed.data
      if (body.type !== 'hello' && body.type !== 'bye' && body.to === '*')
        throw err(400, 'Invalid message')
      const user = await store.users.get(c.get('userId'))
      if (!user) throw err(401, 'Not logged in')

      // A reload leaves no old hello behind, and a room keeps few messages.
      if (body.type === 'hello' || body.type === 'bye')
        await store.messages.deleteFromUser(room, user._id)
      if ((await store.messages.count(room)) >= MAX_IN_ROOM)
        throw err(429, 'Too many messages in this room')

      const now = Date.now()
      const doc: MessageDoc = {
        _id: newMessageId(now),
        room,
        ...body,
        user: { id: user._id, name: user.name, avatar: user.avatar, discordId: user.discordId },
        expiresAt: new Date(now + HOUR_MS),
      }
      await store.messages.add(doc)
      return c.json({ id: doc._id }, 201)
    },
  )

  // No log line here: a page polls every 2 s.
  app.get('/rooms/:code/messages', session, async (c) => {
    const to = c.req.query('to') ?? ''
    if (!PEER_RE.test(to)) throw err(400, 'Invalid request')
    const after = c.req.header('x-after') ?? null
    if (after !== null && !isMessageId(after)) throw err(400, 'Invalid request')
    const room = await seated(c.req.param('code'), c.get('userId'))
    const list = await store.messages.list(room, to, after, POLL_LIMIT)
    return c.json({
      messages: list.map((m) => ({
        id: m._id,
        from: m.from,
        to: m.to,
        type: m.type,
        data: m.data,
        user: m.user,
      })),
    })
  })

  return app
}
