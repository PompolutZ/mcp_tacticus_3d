import { Hono } from 'hono'
import { z } from 'zod'
import { signSession } from '../auth/token'
import type { Config } from '../config'
import { validate } from '../middleware/validate'
import { publicUser, type Store } from '../stores/store'

const bodySchema = z.object({ name: z.string().trim().min(1).max(32) })

// Local only. Only local.ts imports this file, so the Lambda bundle does not have it.
export function devAuthRoutes({ store, config }: { store: Store; config: Config }) {
  const app = new Hono()
  app.post('/auth/dev', validate(bodySchema), async (c) => {
    const { name } = c.req.valid('json')
    const now = new Date()
    const user = await store.users.upsertDiscord(
      { discordId: `dev:${name}`, username: name, name, avatar: null },
      now,
    )
    const token = await signSession(user._id, config.sessionSecret, now)
    return c.json({ token, user: publicUser(user) })
  })
  return app
}
