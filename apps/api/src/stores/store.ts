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
  // The users that exist, by id. Missing ids are left out.
  getMany(ids: string[]): Promise<Map<string, UserDoc>>
}

export type Side = 'blue' | 'red'

export interface Roster {
  code: string
}

export interface RoomDoc {
  _id: string
  version: 1
  host: string
  players: Record<Side, string | null>
  mapId: string
  rosters: Record<Side, Roster | null>
  // A Yjs update. Always set.
  table: Uint8Array
  // +1 on each table write.
  tableRev: number
  createdAt: Date
  updatedAt: Date
  // The TTL index deletes the room after this date.
  expiresAt: Date
}

// What a read without the table returns.
export type RoomInfo = Omit<RoomDoc, 'table'>

export interface NewRoom {
  host: string
  side: Side
  mapId: string
  roster: Roster
  table: Uint8Array
}

// The user hosts a room already.
export class HostingError extends Error {
  constructor() {
    super('The user hosts a room already')
    this.name = 'HostingError'
  }
}

export interface RoomsStore {
  // Inserts with a new code. A duplicate code tries a new one, at most 5 times.
  // Throws HostingError when the host has a room.
  create(room: NewRoom, now: Date, makeCode?: () => string): Promise<RoomInfo>
  // Without the table.
  get(code: string): Promise<RoomInfo | null>
  getTable(code: string): Promise<{ table: Uint8Array; tableRev: number } | null>
  // The rooms where the user has a seat, the last changed first, without the table.
  listForUser(userId: string, limit: number): Promise<RoomInfo[]>
  // Sets the seat and the roster only when the seat is free. True when it wrote.
  join(code: string, side: Side, userId: string, roster: Roster, now: Date): Promise<boolean>
  // Writes only when tableRev is still expectedRev. True when it wrote.
  replaceTable(code: string, expectedRev: number, table: Uint8Array, now: Date): Promise<boolean>
  delete(code: string): Promise<void>
  deleteHostedBy(userId: string): Promise<void>
}

export interface Store {
  users: UsersStore
  rooms: RoomsStore
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

export const CODE_TRIES = 5

export function newRoom(input: NewRoom, code: string, now: Date): RoomDoc {
  const other: Side = input.side === 'blue' ? 'red' : 'blue'
  return {
    _id: code,
    version: 1,
    host: input.host,
    players: { [input.side]: input.host, [other]: null } as Record<Side, string | null>,
    mapId: input.mapId,
    rosters: { [input.side]: input.roster, [other]: null } as Record<Side, Roster | null>,
    table: input.table,
    tableRev: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: userExpiry(now),
  }
}

export type RoomPlayer =
  | { id: string; name: string; avatar: string | null; discordId: string }
  | { id: string; gone: true }

export interface PublicRoom {
  code: string
  host: string
  players: Record<Side, RoomPlayer | null>
  mapId: string
  rosters: Record<Side, Roster | null>
  createdAt: string
  updatedAt: string
}

export function userIdsOf(rooms: RoomInfo[]): string[] {
  const ids = new Set<string>()
  for (const r of rooms) {
    ids.add(r.host)
    if (r.players.blue) ids.add(r.players.blue)
    if (r.players.red) ids.add(r.players.red)
  }
  return [...ids]
}

export function publicRoom(doc: RoomInfo, users: Map<string, UserDoc>): PublicRoom {
  const player = (id: string | null): RoomPlayer | null => {
    if (!id) return null
    const u = users.get(id)
    if (!u) return { id, gone: true }
    return { id, name: u.name, avatar: u.avatar, discordId: u.discordId }
  }
  return {
    code: doc._id,
    host: doc.host,
    players: { blue: player(doc.players.blue), red: player(doc.players.red) },
    mapId: doc.mapId,
    rosters: doc.rosters,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }
}
