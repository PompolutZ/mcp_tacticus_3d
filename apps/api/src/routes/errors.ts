import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import * as z from 'zod/mini'
import { callerIp, createRateLimit } from '../middleware/rateLimit'
import { validate } from '../middleware/validate'
import { REPORT_SIDES, type ErrorReport, type Store } from '../stores/store'

const MAX_BODY = 16 * 1024
const LIMIT_PER_MINUTE = 20

const text = (max: number) => z.string().check(z.maxLength(max))
const reportSchema = z.strictObject({
  message: text(500),
  stack: text(8000),
  version: text(64),
  agent: text(300),
  room: z.optional(text(16)),
  side: z.optional(z.enum(REPORT_SIDES)),
})

export function errorRoutes(deps: { store: Store }) {
  const app = new Hono()
  const allow = createRateLimit(LIMIT_PER_MINUTE)

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
