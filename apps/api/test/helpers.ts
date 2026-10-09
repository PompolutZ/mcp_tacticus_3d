import { createApp } from '../src/app'
import type { Config } from '../src/config'
import { devAuthRoutes } from '../src/routes/devAuth'
import { createMemoryStore } from '../src/stores/memory'
import type { Store } from '../src/stores/store'

export const testConfig: Config = { version: 'test', sessionSecret: 'test-secret', discord: null }

export function makeApp(store: Store = createMemoryStore()) {
  const app = createApp({ store, config: testConfig, discord: null })
  // Same as local.ts.
  app.route('/', devAuthRoutes({ store, config: testConfig }))
  return { app, store }
}
