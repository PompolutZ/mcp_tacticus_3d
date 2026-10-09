import { Hono } from 'hono'
import type { Config } from '../config'
import type { Store } from '../stores/store'

export function healthRoutes({ store, config }: { store: Store; config: Config }) {
  const app = new Hono()
  app.get('/health', async (c) => {
    const db = await store.ping()
    // 503 so that curl --fail and the deploy check see a broken database.
    if (db === 'error') return c.json({ ok: false, version: config.version, db }, 503)
    return c.json({ ok: true, version: config.version, db })
  })
  return app
}
