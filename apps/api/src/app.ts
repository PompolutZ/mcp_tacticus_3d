import { Hono } from 'hono'
import type { DiscordClient } from './auth/discord'
import type { Config } from './config'
import { notFound, onError } from './middleware/errors'
import { log } from './middleware/log'
import { authRoutes } from './routes/auth'
import { boardRoutes } from './routes/board'
import { errorRoutes } from './routes/errors'
import { healthRoutes } from './routes/health'
import { meRoutes } from './routes/me'
import { createSeatCache } from './rooms/seats'
import { roomRoutes } from './routes/rooms'
import { signalRoutes } from './routes/signal'
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
  app.route('/', errorRoutes(deps))
  app.route('/', authRoutes(deps))
  app.route('/', meRoutes(deps))
  app.route('/', boardRoutes(deps))
  app.route('/', roomRoutes(deps))
  app.route('/', tableRoutes(deps))
  // One cache per app, so the seats of a room are read once in 30 s.
  app.route('/', signalRoutes({ ...deps, seats: createSeatCache(deps.store) }))
  app.onError(onError)
  app.notFound(notFound)
  return app
}
