import { newUserId, userExpiry, type Store, type UserDoc } from './store'

export function createMemoryStore(): Store {
  const users = new Map<string, UserDoc>()
  const byDiscordId = new Map<string, string>()
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
    },
    // No database, so there is nothing to ping.
    ping: async () => 'none',
    close: async () => {},
  }
}
