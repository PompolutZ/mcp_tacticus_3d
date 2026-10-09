import { Hono } from 'hono'
import type { DiscordClient } from './auth/discord'
import type { Config } from './config'
import { notFound, onError } from './middleware/errors'
import { log } from './middleware/log'
import { authRoutes } from './routes/auth'
import { healthRoutes } from './routes/health'
import { meRoutes } from './routes/me'
import { roomRoutes } from './routes/rooms'
import { tableRoutes } from './routes/table'
import type { Store } from './stores/store'

export interface Deps {
  store: Store
  config: Config
  // Null: Discord login is off.
  discord: DiscordClient | null
}

export function createApp(deps: Deps) {
  const app = new Hono()
  app.use(log)
  app.route('/', healthRoutes(deps))
  app.route('/', authRoutes(deps))
  app.route('/', meRoutes(deps))
  app.route('/', roomRoutes(deps))
  app.route('/', tableRoutes(deps))
  app.onError(onError)
  app.notFound(notFound)
  return app
}
