import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import * as z from 'zod/mini'
import { validate } from '../middleware/validate'
import { REPORT_SIDES, type ErrorReport, type Store } from '../stores/store'

const MAX_BODY = 16 * 1024
const LIMIT_PER_MINUTE = 20
const WINDOW_MS = 60_000
// The map holds at most this many IPs.
const MAX_TRACKED = 2000

const text = (max: number) => z.string().check(z.maxLength(max))
const reportSchema = z.strictObject({
  message: text(500),
  stack: text(8000),
  version: text(64),
  agent: text(300),
  room: z.optional(text(16)),
  side: z.optional(z.enum(REPORT_SIDES)),
})

// The address of the caller. Lambda function URL: requestContext.http.sourceIp. Node server: the socket.
// Not stored, only the key of the rate limit in memory.
function callerIp(c: Context): string {
  const env = c.env as {
    requestContext?: { http?: { sourceIp?: string } }
    incoming?: { socket?: { remoteAddress?: string } }
  } | null
  return env?.requestContext?.http?.sourceIp ?? env?.incoming?.socket?.remoteAddress ?? 'unknown'
}

// Per IP, per instance, fixed window. A cold instance starts empty: this is a brake, not a wall.
export function createRateLimit(limit = LIMIT_PER_MINUTE, now: () => number = Date.now) {
  const hits = new Map<string, { start: number; count: number }>()
  return (ip: string): boolean => {
    const t = now()
    const entry = hits.get(ip)
    if (entry && t - entry.start < WINDOW_MS) {
      entry.count += 1
      return entry.count <= limit
    }
    if (hits.size >= MAX_TRACKED) {
      for (const [key, e] of hits) if (t - e.start >= WINDOW_MS) hits.delete(key)
      // Still full: drop the oldest entries (Map keeps insertion order).
      for (const key of hits.keys()) {
        if (hits.size < MAX_TRACKED) break
        hits.delete(key)
      }
    }
    hits.delete(ip)
    hits.set(ip, { start: t, count: 1 })
    return true
  }
}

export function errorRoutes(deps: { store: Store }) {
  const app = new Hono()
  const allow = createRateLimit()

  // No login: the browser reports before or without a session.
  app.post(
    '/errors',
    async (c, next) => {
      if (!allow(callerIp(c))) throw new HTTPException(429, { message: 'Too many reports' })
      await next()
    },
    bodyLimit({
      maxSize: MAX_BODY,
      onError: (c) => c.json({ error: 'Report too large' }, 413),
    }),
    validate(reportSchema),
    async (c) => {
      const body = c.req.valid('json')
      // Field by field: the body itself never goes to the store.
      const report: ErrorReport = {
        time: new Date(),
        message: String(body.message),
        stack: String(body.stack),
        version: String(body.version),
        agent: String(body.agent),
      }
      if (body.room !== undefined) report.room = String(body.room)
      if (body.side !== undefined) report.side = body.side
      await deps.store.errors.add(report)
      return c.body(null, 204)
    },
  )

  return app
}
