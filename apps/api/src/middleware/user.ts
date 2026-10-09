import { createMiddleware } from 'hono/factory'
import { verifySession } from '../auth/token'
import type { Config } from '../config'
import type { Store, UserDoc } from '../stores/store'

export interface AuthEnv {
  Variables: { user: UserDoc; tokenIat: number }
}

// Any failure answers the same 401, so a caller learns nothing about why.
export function requireUser({ store, config }: { store: Store; config: Config }) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const match = /^Bearer (.+)$/.exec(c.req.header('Authorization') ?? '')
    const session = match?.[1] ? await verifySession(match[1], config.sessionSecret) : null
    const user = session ? await store.users.get(session.sub) : null
    if (!session || !user) return c.json({ error: 'Not logged in' }, 401)
    c.set('user', user)
    c.set('tokenIat', session.iat)
    await next()
  })
}
