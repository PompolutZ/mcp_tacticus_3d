import { Hono } from 'hono'
import type { Config } from '../config'
import type { Store } from '../stores/store'

export function healthRoutes({ store, config }: { store: Store; config: Config }) {
  const app = new Hono()
  app.get('/health', async (c) =>
    c.json({ ok: true, version: config.version, db: await store.ping() }),
  )
  return app
}
