import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { configFromEnv } from './config'
import { createMemoryStore } from './stores/memory'
import { createMongoStore, isAtlasUri } from './stores/mongo'
import type { Store } from './stores/store'

// Values already set in the shell stay. The file does not override them.
const envFile = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)

function createStore(): Store {
  if (process.env.STORE !== 'mongo') return createMemoryStore()
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('STORE=mongo needs MONGODB_URI')
  // The Atlas string is in infra/.env on this machine. Local dev must not use it.
  if (isAtlasUri(uri)) throw new Error('Local dev does not connect to Atlas. Use a local mongo.')
  return createMongoStore({ uri, dbName: process.env.DB_NAME ?? 'assist3d' })
}

const store = createStore()
const storeName = process.env.STORE === 'mongo' ? 'mongo' : 'memory'
const app = createApp({ store, config: configFromEnv(process.env) })
const port = 8787
serve({ fetch: app.fetch, port }, () =>
  console.log(`API on http://localhost:${port} (store: ${storeName})`),
)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void store.close().finally(() => process.exit(0))
  })
}
