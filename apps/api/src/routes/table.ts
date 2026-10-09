import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { readRoom } from '../rooms/read'
import { isYjsUpdate, mergeTables } from '../rooms/table'
import { requireUser, type AuthEnv } from '../middleware/user'
import type { Config } from '../config'
import type { Store } from '../stores/store'

const MAX_TABLE = 1024 * 1024

const err = (status: 400 | 403 | 404 | 409 | 413, message: string) =>
  new HTTPException(status, { message })

export function tableRoutes(deps: { store: Store; config: Config }) {
  const { store } = deps
  const login = requireUser(deps)
  const app = new Hono<AuthEnv>()

  // 404 for an unknown room, 403 for a user with no seat.
  async function seated(code: string, userId: string): Promise<string> {
    const { room } = await readRoom(store, code)
    if (room.players.blue !== userId && room.players.red !== userId)
      throw err(403, 'No seat in this room')
    return room._id
  }

  app.get('/rooms/:code/table', login, async (c) => {
    const code = await seated(c.req.param('code'), c.get('user')._id)
    const stored = await store.rooms.getTable(code)
    if (!stored) throw err(404, 'Room not found')
    return c.body(new Uint8Array(stored.table), 200, {
      'Content-Type': 'application/octet-stream',
    })
  })

  app.put(
    '/rooms/:code/table',
    login,
    bodyLimit({
      maxSize: MAX_TABLE,
      onError: (c) => c.json({ error: 'Table too large' }, 413),
    }),
    async (c) => {
      const code = await seated(c.req.param('code'), c.get('user')._id)
      const bytes = new Uint8Array(await c.req.arrayBuffer())
      if (!isYjsUpdate(bytes)) throw err(400, 'Invalid table')

      // Two tries: the second one covers a write by the other player in between.
      for (let attempt = 0; attempt < 2; attempt++) {
        const stored = await store.rooms.getTable(code)
        if (!stored) throw err(404, 'Room not found')
        const merged = mergeTables(stored.table, bytes)
        if (merged.length > MAX_TABLE) throw err(413, 'Table too large')
        if (await store.rooms.replaceTable(code, stored.tableRev, merged, new Date())) {
          console.log(`table write body=${bytes.length} merged=${merged.length}`)
          return c.body(null, 204)
        }
      }
      throw err(409, 'The table changed. Try again.')
    },
  )

  return app
}
