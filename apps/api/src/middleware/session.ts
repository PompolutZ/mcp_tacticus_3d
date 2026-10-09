import { createMiddleware } from 'hono/factory'
import { verifySession } from '../auth/token'
import type { Config } from '../config'

export interface SessionEnv {
  Variables: { userId: string }
}

// Checks the token only and reads no user. For routes that are polled (signal routes).
// The same 401 as requireUser.
export function requireSession({ config }: { config: Config }) {
  return createMiddleware<SessionEnv>(async (c, next) => {
    const match = /^Bearer (.+)$/.exec(c.req.header('Authorization') ?? '')
    const session = match?.[1] ? await verifySession(match[1], config.sessionSecret) : null
    if (!session) return c.json({ error: 'Not logged in' }, 401)
    c.set('userId', session.sub)
    await next()
  })
}
