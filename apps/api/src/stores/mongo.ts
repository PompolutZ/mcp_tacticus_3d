import { MongoClient } from 'mongodb'
import { newUserId, userExpiry, type Store, type UserDoc } from './store'

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
  const usersCol = db.collection<UserDoc>('users')

  // Created before the first users call, not at start, so /health still answers
  // 503 when the database is down. A failure clears the promise: the next call retries.
  let indexes: Promise<unknown> | undefined
  const ready = () => {
    indexes ??= Promise.all([
      usersCol.createIndex({ discordId: 1 }, { unique: true }),
      usersCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).catch((err) => {
      indexes = undefined
      throw err
    })
    return indexes
  }

  return {
    users: {
      async upsertDiscord(profile, now) {
        await ready()
        const doc = await usersCol.findOneAndUpdate(
          { discordId: profile.discordId },
          {
            $set: {
              username: profile.username,
              name: profile.name,
              avatar: profile.avatar,
              lastLoginAt: now,
              expiresAt: userExpiry(now),
            },
            $setOnInsert: { _id: newUserId(), createdAt: now },
          },
          { upsert: true, returnDocument: 'after' },
        )
        if (!doc) throw new Error('User upsert returned no document')
        return doc
      },
      async get(id) {
        await ready()
        return usersCol.findOne({ _id: id })
      },
      async touch(id, now) {
        await ready()
        await usersCol.updateOne({ _id: id }, { $set: { expiresAt: userExpiry(now) } })
      },
      async delete(id) {
        await ready()
        await usersCol.deleteOne({ _id: id })
      },
    },
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
