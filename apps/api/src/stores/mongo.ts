import { randomBytes } from 'node:crypto'
import { Binary, MongoClient, MongoServerError } from 'mongodb'
import { newRoomCode } from '../rooms/code'
import {
  CODE_TRIES,
  ERRORS_MAX_BYTES,
  HostingError,
  newRoom,
  newUserId,
  SALT_TTL_MS,
  userExpiry,
  type BoardDoc,
  type ErrorReport,
  type UsageEvent,
  type MessageDoc,
  type RoomDoc,
  type RoomInfo,
  type Store,
  type UserDoc,
} from './store'

// In Mongo the table and the board image are BSON binary.
type RoomRow = Omit<RoomDoc, 'table' | 'image'> & { table: Binary; image?: Binary }
// The board record: the image is BSON binary. A record saved before the images has no image and no hasImage.
type BoardRow = Omit<BoardDoc, 'hasImage'> & { hasImage?: boolean; image?: Binary }

// A record of the current shape. Old records keep the seats under the old color keys and have no players.host.
const CURRENT = { 'players.host': { $exists: true } } as const
const NO_TABLE = { projection: { table: 0, image: 0 } } as const

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
  const messagesCol = db.collection<MessageDoc>('messages')
  const boardsCol = db.collection<BoardRow>('customBoards')
  const errorsCol = db.collection<ErrorReport>('errors')
  const eventsCol = db.collection<UsageEvent>('events')
  const saltsCol = db.collection<{ _id: string; salt: string; expiresAt: Date }>('salts')
  // The salt of the current day, so a busy instance asks Mongo once a day.
  let cachedSalt: { day: string; salt: string } | undefined

  // A capped collection: Mongo deletes the oldest reports when it is full. It must be created
  // before the first insert, or Mongo makes a normal one. Two instances can race: code 48 is fine.
  async function ensureErrorsCollection() {
    try {
      await db.createCollection('errors', { capped: true, size: ERRORS_MAX_BYTES })
    } catch (err) {
      if (!(err instanceof MongoServerError) || err.code !== 48) throw err
    }
  }

  // Created before the first users call, not at start, so /health still answers
  // 503 when the database is down. A failure clears the promise: the next call retries.
  let indexes: Promise<unknown> | undefined
  const ready = () => {
    indexes ??= Promise.all([
      ensureErrorsCollection(),
      usersCol.createIndex({ discordId: 1 }, { unique: true }),
      usersCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      roomsCol.createIndex({ host: 1 }, { unique: true }),
      roomsCol.createIndex({ 'players.host': 1 }),
      roomsCol.createIndex({ 'players.guest': 1 }),
      roomsCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      messagesCol.createIndex({ room: 1, _id: 1 }),
      messagesCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      eventsCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      saltsCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
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
        // An old shape record of this host would block the unique host index.
        await roomsCol.deleteMany({ host: input.host, 'players.host': { $exists: false } })
        for (let i = 0; i < CODE_TRIES; i++) {
          const doc = newRoom(input, makeCode(), now)
          try {
            const { image, ...row } = doc
            await roomsCol.insertOne({
              ...row,
              table: new Binary(input.table),
              ...(image ? { image: new Binary(image) } : {}),
            })
            const { table: _table, image: _image, ...rest } = doc
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
        return roomsCol.findOne({ _id: code, ...CURRENT }, NO_TABLE) as Promise<RoomInfo | null>
      },
      async getTable(code) {
        await ready()
        const doc = await roomsCol.findOne({ _id: code }, { projection: { table: 1, tableRev: 1 } })
        if (!doc) return null
        // A plain Uint8Array, not the driver's Buffer.
        return { table: new Uint8Array(doc.table.value()), tableRev: doc.tableRev }
      },
      async getImage(code) {
        await ready()
        const doc = await roomsCol.findOne({ _id: code, ...CURRENT }, { projection: { image: 1 } })
        return doc?.image ? new Uint8Array(doc.image.value()) : null
      },
      async listForUser(userId, limit) {
        await ready()
        return roomsCol
          .find({ $or: [{ 'players.host': userId }, { 'players.guest': userId }] }, NO_TABLE)
          .sort({ updatedAt: -1 })
          .limit(limit)
          .toArray() as Promise<RoomInfo[]>
      },
      async join(code, side, userId, roster, now, mapId) {
        await ready()
        const res = await roomsCol.updateOne(
          { _id: code, ...CURRENT, [`players.${side}`]: null },
          {
            $set: {
              [`players.${side}`]: userId,
              [`rosters.${side}`]: roster,
              ...(mapId === undefined ? {} : { mapId }),
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
    messages: {
      async add(message) {
        await ready()
        await messagesCol.insertOne(message)
      },
      async deleteFromUser(room, userId) {
        await ready()
        await messagesCol.deleteMany({ room, 'user.id': userId })
      },
      async count(room) {
        await ready()
        return messagesCol.countDocuments({ room })
      },
      async list(room, peer, after, limit) {
        await ready()
        return messagesCol
          .find({
            room,
            from: { $ne: peer },
            to: { $in: [peer, '*'] },
            ...(after === null ? {} : { _id: { $gt: after } }),
          })
          .sort({ _id: 1 })
          .limit(limit)
          .toArray()
      },
      async deleteRoom(room) {
        await ready()
        await messagesCol.deleteMany({ room })
      },
      async deleteUser(userId) {
        await ready()
        await messagesCol.deleteMany({ 'user.id': userId })
      },
    },
    boards: {
      async get(userId) {
        await ready()
        const doc = await boardsCol.findOne({ _id: userId }, { projection: { image: 0 } })
        if (!doc) return null
        return {
          _id: doc._id,
          board: doc.board,
          updatedAt: doc.updatedAt,
          hasImage: doc.hasImage === true,
        }
      },
      async put(userId, board, now, image) {
        await ready()
        const row: Omit<BoardRow, '_id'> = { board, updatedAt: now, hasImage: image !== undefined }
        if (image) row.image = new Binary(image)
        await boardsCol.replaceOne({ _id: userId }, row, { upsert: true })
      },
      async getImage(userId) {
        await ready()
        const doc = await boardsCol.findOne({ _id: userId }, { projection: { image: 1 } })
        return doc?.image ? new Uint8Array(doc.image.value()) : null
      },
      async delete(userId) {
        await ready()
        await boardsCol.deleteOne({ _id: userId })
      },
    },
    errors: {
      async add(report) {
        await ready()
        await errorsCol.insertOne({ ...report })
      },
      async latest(limit) {
        await ready()
        const docs = await errorsCol
          .find({}, { projection: { _id: 0 } })
          .sort({ $natural: -1 })
          .limit(limit)
          .toArray()
        return docs
      },
    },
    events: {
      async add(event) {
        await ready()
        await eventsCol.insertOne({ ...event })
      },
    },
    salts: {
      async forDay(day) {
        if (cachedSalt?.day === day) return cachedSalt.salt
        await ready()
        // Two instances can race: $setOnInsert keeps the first salt, both read it back.
        const doc = await saltsCol.findOneAndUpdate(
          { _id: day },
          {
            $setOnInsert: {
              salt: randomBytes(16).toString('hex'),
              expiresAt: new Date(Date.parse(`${day}T00:00:00Z`) + SALT_TTL_MS),
            },
          },
          { upsert: true, returnDocument: 'after' },
        )
        if (!doc) throw new Error('Salt upsert returned no document')
        cachedSalt = { day, salt: doc.salt }
        return doc.salt
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
