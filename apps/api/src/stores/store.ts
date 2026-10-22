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

// A seat. The host sits at +z, the guest at -z. Not a color (docs/features/setup-game.md).
export type Side = 'host' | 'guest'

export interface Roster {
  code: string
}

export interface RoomDoc {
  _id: string
  version: 1
  host: string
  players: Record<Side, string | null>
  // null: a random room. The server picks one of `maps` at the guest's join.
  mapId: string | null
  maps?: string[]
  rosters: Record<Side, Roster | null>
  // A room on the custom board ('custom') keeps its own copy of the board name, the author and the top view (WebP),
  // made at creation (docs/features/map-builder.md, "Board in a new room"). A later save to the account does not change it.
  boardName?: string
  boardAuthor?: string
  hasImage?: boolean
  image?: Uint8Array
  // A Yjs update. Always set.
  table: Uint8Array
  // +1 on each table write.
  tableRev: number
  createdAt: Date
  updatedAt: Date
  // The TTL index deletes the room after this date.
  expiresAt: Date
}

// What a read without the table and the image returns.
export type RoomInfo = Omit<RoomDoc, 'table' | 'image'>

export interface NewRoom {
  host: string
  mapId: string | null
  maps?: string[]
  roster: Roster
  table: Uint8Array
  // The copy of the board of the account, for mapId 'custom'. image: none when the board has none.
  board?: { name: string; author: string; image?: Uint8Array }
}

// The user hosts a room already.
export class HostingError extends Error {
  constructor() {
    super('The user hosts a room already')
    this.name = 'HostingError'
  }
}

export interface RoomsStore {
  // Inserts with a new code. First deletes old shape records of the same host. A duplicate code tries a new one, at most 5 times.
  // Throws HostingError when the host has a room.
  create(room: NewRoom, now: Date, makeCode?: () => string): Promise<RoomInfo>
  // Without the table. A record of the old shape (seats under color keys) is not read: null.
  get(code: string): Promise<RoomInfo | null>
  getTable(code: string): Promise<{ table: Uint8Array; tableRev: number } | null>
  // The top view copy of the room (WebP), or null. get and listForUser never return it.
  getImage(code: string): Promise<Uint8Array | null>
  // The rooms where the user has a seat, the last changed first, without the table. Old shape records are left out.
  listForUser(userId: string, limit: number): Promise<RoomInfo[]>
  // Sets the seat and the roster only when the seat is free. True when it wrote.
  // With mapId, it sets the map in the same write.
  join(
    code: string,
    side: Side,
    userId: string,
    roster: Roster,
    now: Date,
    mapId?: string,
  ): Promise<boolean>
  // Writes only when tableRev is still expectedRev. True when it wrote.
  replaceTable(code: string, expectedRev: number, table: Uint8Array, now: Date): Promise<boolean>
  delete(code: string): Promise<void>
  deleteHostedBy(userId: string): Promise<void>
}

export type MessageType = 'hello' | 'offer' | 'answer' | 'bye'

export type MessageUser = Pick<PublicUser, 'id' | 'name' | 'avatar' | 'discordId'>

export interface MessageDoc {
  _id: string
  room: string
  // Peer ids.
  from: string
  to: string
  type: MessageType
  data: string
  // Set by the server.
  user: MessageUser
  // The TTL index deletes the message after this date.
  expiresAt: Date
}

export interface MessagesStore {
  add(message: MessageDoc): Promise<void>
  // For hello and bye: the user's older messages in the room.
  deleteFromUser(room: string, userId: string): Promise<void>
  count(room: string): Promise<number>
  // To the peer or to '*', not from the peer, id after `after` (all when null). Oldest first.
  list(room: string, peer: string, after: string | null, limit: number): Promise<MessageDoc[]>
  deleteRoom(room: string): Promise<void>
  deleteUser(userId: string): Promise<void>
}

// Where the report came from. 'none': a multiplayer room with no seat.
export const REPORT_SIDES = ['host', 'guest', 'none'] as const
export type ReportSide = (typeof REPORT_SIDES)[number]

// A client error report. Built field by field by the route (routes/errors.ts).
export interface ErrorReport {
  // Set by the server.
  time: Date
  message: string
  stack: string
  version: string
  agent: string
  room?: string
  side?: ReportSide
}

export interface ErrorsStore {
  add(report: ErrorReport): Promise<void>
  // The newest first.
  latest(limit: number): Promise<ErrorReport[]>
}

export const ERRORS_KEEP = 200
// The Mongo collection is capped at this size.
export const ERRORS_MAX_BYTES = 10 * 1024 * 1024

// The usage events (docs/features/analytics.md). A new event adds a name here.
export const EVENT_NAMES = [
  'app_open',
  'sandbox_open',
  'room_create',
  'room_open',
  'room_join',
] as const
export type EventName = (typeof EVENT_NAMES)[number]
export const EVENT_KINDS = ['solo', 'versus'] as const
export type EventKind = (typeof EVENT_KINDS)[number]

// Built field by field by the route (routes/events.ts). No IP, no user agent, no user id.
export interface UsageEvent {
  // Set by the server.
  time: Date
  name: EventName
  kind?: EventKind
  version: string
  // A hash of the daily salt, the IP and the user agent, cut short.
  visitor: string
}

export interface EventsStore {
  add(event: UsageEvent): Promise<void>
}

export interface SaltsStore {
  // The random salt of a UTC day (YYYY-MM-DD). All instances get the same one.
  forDay(day: string): Promise<string>
}

// Events are deleted this long after their time.
export const EVENTS_TTL_SECONDS = 13 * 30 * 24 * 60 * 60

// The salt of a day is deleted this long after the start of the day.
export const SALT_TTL_MS = 2 * 24 * 60 * 60 * 1000

// The Sandbox board of a user: the map JSON format of the web app (docs/features/map-builder.md).
export interface Board {
  id?: string
  name?: string
  // The display name of the user at the last save. Set by the server, never from the body.
  author?: string
  mat: string
  matRotation: number
  placements: BoardPlacement[]
}

export interface BoardPlacement {
  piece: string
  position: number[]
  rotation: number[]
  scale: number | number[]
  size?: number
  tint?: number[]
}

// One record per user, _id is the user id. The top view image (WebP) is stored in the record, and read apart
// with getImage, so get does not move its bytes. hasImage: false for a record saved before the images.
export interface BoardDoc {
  _id: string
  board: Board
  updatedAt: Date
  hasImage: boolean
}

export interface BoardsStore {
  get(userId: string): Promise<BoardDoc | null>
  // Replaces the board of the user, and its image (none when image is undefined).
  put(userId: string, board: Board, now: Date, image?: Uint8Array): Promise<void>
  getImage(userId: string): Promise<Uint8Array | null>
  delete(userId: string): Promise<void>
}

export interface Store {
  users: UsersStore
  boards: BoardsStore
  rooms: RoomsStore
  messages: MessagesStore
  errors: ErrorsStore
  events: EventsStore
  salts: SaltsStore
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
  return {
    _id: code,
    version: 1,
    host: input.host,
    players: { host: input.host, guest: null },
    mapId: input.mapId,
    ...(input.maps ? { maps: input.maps } : {}),
    rosters: { host: input.roster, guest: null },
    ...(input.board
      ? {
          boardName: input.board.name,
          boardAuthor: input.board.author,
          hasImage: input.board.image !== undefined,
          ...(input.board.image ? { image: input.board.image } : {}),
        }
      : {}),
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
  mapId: string | null
  rosters: Record<Side, Roster | null>
  // Only in a room on the custom board
  boardName?: string
  boardAuthor?: string
  hasImage?: boolean
  createdAt: string
  updatedAt: string
}

export function userIdsOf(rooms: RoomInfo[]): string[] {
  const ids = new Set<string>()
  for (const r of rooms) {
    ids.add(r.host)
    if (r.players.host) ids.add(r.players.host)
    if (r.players.guest) ids.add(r.players.guest)
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
    players: { host: player(doc.players.host), guest: player(doc.players.guest) },
    mapId: doc.mapId,
    rosters: doc.rosters,
    ...(doc.boardName !== undefined
      ? {
          boardName: doc.boardName,
          boardAuthor: doc.boardAuthor ?? '',
          hasImage: doc.hasImage === true,
        }
      : {}),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }
}
