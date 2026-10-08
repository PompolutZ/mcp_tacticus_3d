import { Hono } from 'hono'
import type { Config } from './config'
import { notFound, onError } from './middleware/errors'
import { log } from './middleware/log'
import { healthRoutes } from './routes/health'
import type { Store } from './stores/store'

export interface Deps {
  store: Store
  config: Config
}

export function createApp(deps: Deps) {
  const app = new Hono()
  app.use(log)
  app.route('/', healthRoutes(deps))
  app.onError(onError)
  app.notFound(notFound)
  return app
}
