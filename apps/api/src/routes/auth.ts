import { Hono } from 'hono'
import { z } from 'zod'
import { DiscordError } from '../auth/discord'
import { signSession } from '../auth/token'
import { validate } from '../middleware/validate'
import { publicUser } from '../stores/store'
import type { Deps } from '../app'

const bodySchema = z.object({
  code: z.string().min(1).max(200),
  // Discord checks that it is a registered redirect URI.
  redirectUri: z.url({ protocol: /^https?$/ }).max(200),
})

export function authRoutes({ store, config, discord }: Deps) {
  const app = new Hono()
  app.post('/auth/discord', validate(bodySchema), async (c) => {
    if (!discord) return c.json({ error: 'Discord login is not set up' }, 503)
    const { code, redirectUri } = c.req.valid('json')
    try {
      const accessToken = await discord.exchangeCode(code, redirectUri)
      const profile = await discord.getProfile(accessToken)
      const now = new Date()
      const user = await store.users.upsertDiscord(profile, now)
      const token = await signSession(user._id, config.sessionSecret, now)
      return c.json({ token, user: publicUser(user) })
    } catch (err) {
      if (err instanceof DiscordError)
        return c.json({ error: err.message }, err.kind === 'rejected' ? 401 : 502)
      throw err
    }
  })
  return app
}
