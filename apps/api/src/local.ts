import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { configFromEnv } from './config'
import { createMemoryStore } from './stores/memory'

// Values already set in the shell stay. The file does not override them.
const envFile = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)

const app = createApp({ store: createMemoryStore(), config: configFromEnv(process.env) })
const port = 8787
serve({ fetch: app.fetch, port }, () => console.log(`API on http://localhost:${port}`))
