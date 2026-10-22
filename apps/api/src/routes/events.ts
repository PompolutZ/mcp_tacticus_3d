import { createHash } from 'node:crypto'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import * as z from 'zod/mini'
import { callerIp, createRateLimit } from '../middleware/rateLimit'
import { validate } from '../middleware/validate'
import { EVENT_KINDS, EVENT_NAMES, type Store, type UsageEvent } from '../stores/store'

const MAX_BODY = 1024
const LIMIT_PER_MINUTE = 60
const BOT_AGENT = /bot|crawler|spider|headless/i

const eventSchema = z.strictObject({
  name: z.enum(EVENT_NAMES),
  kind: z.optional(z.enum(EVENT_KINDS)),
  version: z.string().check(z.maxLength(64)),
})

// Same IP and agent on the same UTC day give the same visitor. The IP and the agent are never stored.
function visitorHash(salt: string, ip: string, agent: string): string {
  return createHash('sha256').update(`${salt}${ip}${agent}`).digest('hex').slice(0, 16)
}

export function eventRoutes(deps: { store: Store; now?: () => Date }) {
  const app = new Hono()
  const allow = createRateLimit(LIMIT_PER_MINUTE)
  const now = deps.now ?? (() => new Date())

  // No login, and the token is not read: an event has no user id.
  app.post(
    '/events',
    async (c, next) => {
      if (!allow(callerIp(c))) throw new HTTPException(429, { message: 'Too many events' })
      await next()
    },
    bodyLimit({
      maxSize: MAX_BODY,
      onError: (c) => c.json({ error: 'Event too large' }, 413),
    }),
    validate(eventSchema),
    async (c) => {
      const agent = c.req.header('user-agent') ?? ''
      if (BOT_AGENT.test(agent)) return c.body(null, 204)
      const body = c.req.valid('json')
      const time = now()
      const day = time.toISOString().slice(0, 10)
      const salt = await deps.store.salts.forDay(day)
      // Field by field: the body itself never goes to the store.
      const event: UsageEvent = {
        time,
        name: body.name,
        version: String(body.version),
        visitor: visitorHash(salt, callerIp(c), agent),
      }
      if (body.kind !== undefined) event.kind = body.kind
      await deps.store.events.add(event)
      return c.body(null, 204)
    },
  )

  return app
}
