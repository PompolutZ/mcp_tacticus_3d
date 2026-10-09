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

function info({ table: _table, ...rest }: RoomDoc): RoomInfo {
  return { ...rest, players: { ...rest.players }, rosters: { ...rest.rosters } }
}

export function createMemoryStore(): Store {
  const users = new Map<string, UserDoc>()
  const byDiscordId = new Map<string, string>()
  const rooms = new Map<string, RoomDoc>()
  return {
    users: {
      async upsertDiscord(profile, now) {
        const id = byDiscordId.get(profile.discordId)
        const old = id ? users.get(id) : undefined
        const doc: UserDoc = {
          _id: old?._id ?? newUserId(),
          createdAt: old?.createdAt ?? now,
          ...profile,
          lastLoginAt: now,
          expiresAt: userExpiry(now),
        }
        users.set(doc._id, doc)
        byDiscordId.set(doc.discordId, doc._id)
        return { ...doc }
      },
      async get(id) {
        const doc = users.get(id)
        return doc ? { ...doc } : null
      },
      async touch(id, now) {
        const doc = users.get(id)
        if (doc) doc.expiresAt = userExpiry(now)
      },
      async delete(id) {
        const doc = users.get(id)
        if (!doc) return
        users.delete(id)
        byDiscordId.delete(doc.discordId)
      },
      async getMany(ids) {
        const found = new Map<string, UserDoc>()
        for (const id of ids) {
          const doc = users.get(id)
          if (doc) found.set(id, { ...doc })
        }
        return found
      },
    },
    rooms: {
      async create(input, now, makeCode = newRoomCode) {
        for (const room of rooms.values()) if (room.host === input.host) throw new HostingError()
        for (let i = 0; i < CODE_TRIES; i++) {
          const code = makeCode()
          if (rooms.has(code)) continue
          const doc = newRoom(input, code, now)
          rooms.set(code, doc)
          return info(doc)
        }
        throw new Error('No free room code')
      },
      async get(code) {
        const doc = rooms.get(code)
        return doc ? info(doc) : null
      },
      async getTable(code) {
        const doc = rooms.get(code)
        return doc ? { table: doc.table, tableRev: doc.tableRev } : null
      },
      async listForUser(userId, limit) {
        return [...rooms.values()]
          .filter((r) => r.players.blue === userId || r.players.red === userId)
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .slice(0, limit)
          .map(info)
      },
      async join(code, side, userId, roster, now) {
        const doc = rooms.get(code)
        if (!doc || doc.players[side] !== null) return false
        doc.players[side] = userId
        doc.rosters[side] = roster
        doc.updatedAt = now
        doc.expiresAt = userExpiry(now)
        return true
      },
      async replaceTable(code, expectedRev, table, now) {
        const doc = rooms.get(code)
        if (!doc || doc.tableRev !== expectedRev) return false
        doc.table = table
        doc.tableRev += 1
        doc.updatedAt = now
        doc.expiresAt = userExpiry(now)
        return true
      },
      async delete(code) {
        rooms.delete(code)
      },
      async deleteHostedBy(userId) {
        for (const [code, room] of rooms) if (room.host === userId) rooms.delete(code)
      },
    },
    // No database, so there is nothing to ping.
    ping: async () => 'none',
    close: async () => {},
  }
}
