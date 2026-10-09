import { Binary, MongoClient, MongoServerError } from 'mongodb'
import { newRoomCode } from '../rooms/code'
import {
  CODE_TRIES,
  HostingError,
  newRoom,
  newUserId,
  userExpiry,
  type RoomDoc,
  type RoomInfo,
  type Store,
  type UserDoc,
} from './store'

// In Mongo the table is BSON binary.
type RoomRow = Omit<RoomDoc, 'table'> & { table: Binary }

const NO_TABLE = { projection: { table: 0 } } as const

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
  const roomsCol = db.collection<RoomRow>('rooms')

  // Created before the first users call, not at start, so /health still answers
  // 503 when the database is down. A failure clears the promise: the next call retries.
  let indexes: Promise<unknown> | undefined
  const ready = () => {
    indexes ??= Promise.all([
      usersCol.createIndex({ discordId: 1 }, { unique: true }),
      usersCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      roomsCol.createIndex({ host: 1 }, { unique: true }),
      roomsCol.createIndex({ 'players.blue': 1 }),
      roomsCol.createIndex({ 'players.red': 1 }),
      roomsCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
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
      async getMany(ids) {
        await ready()
        const docs = await usersCol.find({ _id: { $in: ids } }).toArray()
        return new Map(docs.map((d) => [d._id, d]))
      },
    },
    rooms: {
      async create(input, now, makeCode = newRoomCode) {
        await ready()
        for (let i = 0; i < CODE_TRIES; i++) {
          const doc = newRoom(input, makeCode(), now)
          try {
            await roomsCol.insertOne({ ...doc, table: new Binary(input.table) })
            const { table: _table, ...rest } = doc
            return rest
          } catch (err) {
            if (!(err instanceof MongoServerError) || err.code !== 11000) throw err
            // The index name tells which key was a duplicate.
            if (err.keyPattern?.host) throw new HostingError()
          }
        }
        throw new Error('No free room code')
      },
      async get(code) {
        await ready()
        return roomsCol.findOne({ _id: code }, NO_TABLE) as Promise<RoomInfo | null>
      },
      async getTable(code) {
        await ready()
        const doc = await roomsCol.findOne({ _id: code }, { projection: { table: 1, tableRev: 1 } })
        if (!doc) return null
        // A plain Uint8Array, not the driver's Buffer.
        return { table: new Uint8Array(doc.table.value()), tableRev: doc.tableRev }
      },
      async listForUser(userId, limit) {
        await ready()
        return roomsCol
          .find({ $or: [{ 'players.blue': userId }, { 'players.red': userId }] }, NO_TABLE)
          .sort({ updatedAt: -1 })
          .limit(limit)
          .toArray() as Promise<RoomInfo[]>
      },
      async join(code, side, userId, roster, now) {
        await ready()
        const res = await roomsCol.updateOne(
          { _id: code, [`players.${side}`]: null },
          {
            $set: {
              [`players.${side}`]: userId,
              [`rosters.${side}`]: roster,
              updatedAt: now,
              expiresAt: userExpiry(now),
            },
          },
        )
        return res.modifiedCount === 1
      },
      async replaceTable(code, expectedRev, table, now) {
        await ready()
        const res = await roomsCol.updateOne(
          { _id: code, tableRev: expectedRev },
          {
            $set: { table: new Binary(table), updatedAt: now, expiresAt: userExpiry(now) },
            $inc: { tableRev: 1 },
          },
        )
        return res.modifiedCount === 1
      },
      async delete(code) {
        await ready()
        await roomsCol.deleteOne({ _id: code })
      },
      async deleteHostedBy(userId) {
        await ready()
        await roomsCol.deleteMany({ host: userId })
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
