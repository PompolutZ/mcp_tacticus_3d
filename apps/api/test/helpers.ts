import * as Y from 'yjs'
import { signSession } from '../src/auth/token'
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

export async function addUser(store: Store, name: string) {
  const user = await store.users.upsertDiscord(
    { discordId: `dev:${name}`, username: name, name, avatar: null },
    new Date(),
  )
  const token = await signSession(user._id, testConfig.sessionSecret, new Date())
  return { id: user._id, headers: { Authorization: `Bearer ${token}` } }
}

// A Yjs update from a new document that sets one key of the table map.
export function tableUpdate(entries: Record<string, string>): Uint8Array {
  const doc = new Y.Doc()
  const map = doc.getMap('table')
  for (const [k, v] of Object.entries(entries)) map.set(k, v)
  return Y.encodeStateAsUpdate(doc)
}

export function tableEntries(bytes: Uint8Array): Record<string, unknown> {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, bytes)
  return doc.getMap('table').toJSON()
}
