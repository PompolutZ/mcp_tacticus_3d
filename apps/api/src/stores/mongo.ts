import { MongoClient } from 'mongodb'
import type { Store } from './store'

export interface MongoOptions {
  uri: string
  dbName: string
  serverSelectionTimeoutMS?: number
}

// Local dev must never reach Atlas (see local.ts). The regex covers SRV and
// multi-host strings, which `new URL` cannot parse.
export function isAtlasUri(uri: string): boolean {
  return /\.mongodb\.net(?=[:,/?]|$)/i.test(uri)
}

export function createMongoStore({
  uri,
  dbName,
  serverSelectionTimeoutMS = 5000,
}: MongoOptions): Store {
  // One client per process. The driver connects on the first command.
  const client = new MongoClient(uri, { maxPoolSize: 2, serverSelectionTimeoutMS })
  const db = client.db(dbName)
  return {
    async ping() {
      try {
        await db.command({ ping: 1 })
        return 'ok'
      } catch (err) {
        // Name and message only. The message must not hold the URI.
        const e = err as Error
        console.error(`mongo ping failed: ${e.name}: ${e.message}`)
        return 'error'
      }
    },
    close: () => client.close(),
  }
}
