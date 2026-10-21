import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { randomInt } from 'node:crypto'
import * as z from 'zod/mini'
import { requireUser, type AuthEnv } from '../middleware/user'
import { validate } from '../middleware/validate'
import { readRoom as readRoomOf } from '../rooms/read'
import { isYjsUpdate } from '../rooms/table'
import { HostingError, publicRoom, userIdsOf, type RoomInfo, type Store } from '../stores/store'
import type { Config } from '../config'

const MAX_TABLE = 1024 * 1024
// The map id of a room on the board of the account (CUSTOM_MAP_ID in rooms/table.js on the web)
const CUSTOM_MAP_ID = 'custom'
const LIST_LIMIT = 100

const rosterSchema = z.object({ code: z.string().check(z.minLength(1), z.maxLength(1000)) })
const mapIdSchema = z.string().check(z.regex(/^[a-z0-9-]{1,64}$/))
// Either a chosen map or the list to pick from at join. Exactly one.
const createSchema = z
  .object({
    mapId: z.optional(mapIdSchema),
    maps: z.optional(z.array(mapIdSchema).check(z.minLength(1), z.maxLength(50))),
    roster: rosterSchema,
    table: z.string().check(z.minLength(1)),
  })
  .check(z.refine((b) => (b.mapId === undefined) !== (b.maps === undefined)))
const joinSchema = z.object({ roster: rosterSchema })

const base64Re = /^[A-Za-z0-9+/]*={0,2}$/

const err = (status: 400 | 403 | 404 | 409 | 413, message: string) =>
  new HTTPException(status, { message })

export function roomRoutes(deps: { store: Store; config: Config }) {
  const { store } = deps
  const login = requireUser(deps)
  const app = new Hono<AuthEnv>()

  const readRoom = (code: string) => readRoomOf(store, code)

  app.get('/rooms', login, async (c) => {
    const userId = c.get('user')._id
    const all = await store.rooms.listForUser(userId, LIST_LIMIT)
    const users = await store.users.getMany(userIdsOf(all))
    const rooms: RoomInfo[] = []
    for (const room of all) {
      if (users.has(room.host)) rooms.push(room)
      else await store.rooms.delete(room._id)
    }
    return c.json({ rooms: rooms.map((r) => publicRoom(r, users)) })
  })

  app.post(
    '/rooms',
    login,
    // Base64 is a third bigger than the bytes. The exact limit is checked after the decode.
    bodyLimit({
      maxSize: Math.ceil((MAX_TABLE * 4) / 3) + 4096,
      onError: (c) => c.json({ error: 'Table too large' }, 413),
    }),
    validate(createSchema),
    async (c) => {
      const user = c.get('user')
      const body = c.req.valid('json')
      if (!base64Re.test(body.table) || body.table.length % 4 !== 0) throw err(400, 'Invalid table')
      const table = new Uint8Array(Buffer.from(body.table, 'base64'))
      if (table.length > MAX_TABLE) throw err(413, 'Table too large')
      if (!isYjsUpdate(table)) throw err(400, 'Invalid table')
      // A room on the custom board copies name, author and image from the board of the same user, here on the
      // server: no upload, nothing from the client to trust. The account has no board: the room has no copy.
      const saved = body.mapId === CUSTOM_MAP_ID ? await store.boards.get(user._id) : null
      const image = saved?.hasImage ? await store.boards.getImage(user._id) : null
      try {
        const room = await store.rooms.create(
          {
            host: user._id,
            mapId: body.mapId ?? null,
            ...(body.maps ? { maps: body.maps } : {}),
            roster: body.roster,
            table,
            ...(saved
              ? {
                  board: {
                    name: saved.board.name ?? '',
                    author: saved.board.author ?? '',
                    ...(image ? { image } : {}),
                  },
                }
              : {}),
          },
          new Date(),
        )
        return c.json({ room: publicRoom(room, new Map([[user._id, user]])) }, 201)
      } catch (e) {
        if (e instanceof HostingError)
          throw err(409, 'You host a multiplayer room already. Delete it first.')
        throw e
      }
    },
  )

  app.get('/rooms/:code', async (c) => {
    const { room, users } = await readRoom(c.req.param('code'))
    return c.json({ room: publicRoom(room, users) })
  })

  // The top view copy of a room on the custom board. Open like GET /rooms/{code}: the room code is the secret, and
  // the join page shows the card before the login. 404 for an unknown room, or a room with no image.
  app.get('/rooms/:code/image', async (c) => {
    const { room } = await readRoom(c.req.param('code'))
    const image = room.hasImage ? await store.rooms.getImage(room._id) : null
    if (!image) throw err(404, 'No image')
    return c.body(image as Uint8Array<ArrayBuffer>, 200, {
      'Content-Type': 'image/webp',
      'Cache-Control': 'private, no-cache',
    })
  })

  app.post('/rooms/:code/join', login, validate(joinSchema), async (c) => {
    const userId = c.get('user')._id
    const { roster } = c.req.valid('json')
    const { room } = await readRoom(c.req.param('code'))
    const seated = room.players.host === userId || room.players.guest === userId
    if (!seated) {
      // The host seat is never free, so the free seat is the guest seat.
      // A random room has no map yet: pick one with the seat, in one write.
      const pick =
        room.mapId === null && room.maps?.length
          ? room.maps[randomInt(room.maps.length)]
          : undefined
      if (!(await store.rooms.join(room._id, 'guest', userId, roster, new Date(), pick)))
        throw err(409, 'This room has two players already')
    }
    // Read again: the seat, the roster and the dates changed.
    const { room: fresh, users } = await readRoom(room._id)
    return c.json({ room: publicRoom(fresh, users) })
  })

  app.delete('/rooms/:code', login, async (c) => {
    const { room } = await readRoom(c.req.param('code'))
    if (room.host !== c.get('user')._id) throw err(403, 'Only the host can do this')
    await store.rooms.delete(room._id)
    await store.messages.deleteRoom(room._id)
    return c.body(null, 204)
  })

  return app
}
