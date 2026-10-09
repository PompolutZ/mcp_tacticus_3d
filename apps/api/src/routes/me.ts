import { Hono } from 'hono'
import { signSession } from '../auth/token'
import type { Config } from '../config'
import { requireUser, type AuthEnv } from '../middleware/user'
import { publicUser, type Store } from '../stores/store'

const DAY_MS = 24 * 60 * 60 * 1000

export function meRoutes(deps: { store: Store; config: Config }) {
  const { store, config } = deps
  const app = new Hono<AuthEnv>()
  app.use('/me', requireUser(deps))

  app.get('/me', async (c) => {
    const user = c.get('user')
    const now = new Date()
    if (now.getTime() - c.get('tokenIat') * 1000 <= DAY_MS)
      return c.json({ user: publicUser(user) })
    // A player who only opens the app never logs in again. Renewing also moves the
    // user expiry, so the TTL does not delete an active player.
    await store.users.touch(user._id, now)
    const token = await signSession(user._id, config.sessionSecret, now)
    return c.json({ user: publicUser(user), token })
  })

  app.delete('/me', async (c) => {
    const id = c.get('user')._id
    // Rooms first. If the user delete fails, a second call finishes the work.
    await store.rooms.deleteHostedBy(id)
    await store.users.delete(id)
    return c.body(null, 204)
  })
  return app
}
