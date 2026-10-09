import { randomBytes } from 'node:crypto'

export type DbStatus = 'none' | 'ok' | 'error'

export interface UserDoc {
  _id: string
  discordId: string
  username: string
  name: string
  avatar: string | null
  createdAt: Date
  lastLoginAt: Date
  // The TTL index deletes the user after this date.
  expiresAt: Date
}

export interface DiscordProfile {
  discordId: string
  username: string
  name: string
  avatar: string | null
}

export interface PublicUser {
  id: string
  discordId: string
  username: string
  name: string
  avatar: string | null
}

export interface UsersStore {
  // Finds the user by discordId. Creates it, or updates the profile and the dates.
  upsertDiscord(profile: DiscordProfile, now: Date): Promise<UserDoc>
  get(id: string): Promise<UserDoc | null>
  // Moves expiresAt to 12 months after now.
  touch(id: string, now: Date): Promise<void>
  delete(id: string): Promise<void>
}

// Later steps add the rooms and messages stores here.
export interface Store {
  users: UsersStore
  ping(): Promise<DbStatus>
  close(): Promise<void>
}

export function newUserId(): string {
  return `u_${randomBytes(12).toString('base64url')}`
}

export function userExpiry(now: Date): Date {
  const d = new Date(now)
  d.setUTCMonth(d.getUTCMonth() + 12)
  return d
}

export function publicUser(doc: UserDoc): PublicUser {
  return {
    id: doc._id,
    discordId: doc.discordId,
    username: doc.username,
    name: doc.name,
    avatar: doc.avatar,
  }
}
