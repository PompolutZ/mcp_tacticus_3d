import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { signSession } from '../src/auth/token'
import { isRoomCode, newRoomCode } from '../src/rooms/code'
import { isYjsUpdate } from '../src/rooms/table'
import type { PublicRoom } from '../src/stores/store'
import { makeApp, testConfig } from './helpers'

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

// Built once: each Y.Doc has a random client id.
const doc = new Y.Doc()
doc.getMap('table').set('mapId', 'vibranium-heist')
const bytes = Y.encodeStateAsUpdate(doc)
const tableBytes = () => bytes
const tableB64 = () => Buffer.from(bytes).toString('base64')

async function setup() {
  const { app, store } = makeApp()
  const users: Record<string, { id: string; headers: Record<string, string> }> = {}
  for (const name of ['alice', 'bob', 'carol']) {
    const u = await store.users.upsertDiscord(
      { discordId: `dev:${name}`, username: name, name, avatar: null },
      new Date(),
    )
    const token = await signSession(u._id, testConfig.sessionSecret, new Date())
    users[name] = { id: u._id, headers: { Authorization: `Bearer ${token}` } }
  }
  const call = (who: string | null, method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: {
        ...(who ? users[who]?.headers : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  const createBody = (over: object = {}) => ({
    mapId: 'vibranium-heist',
    side: 'blue',
    roster: { code: 'abc' },
    table: tableB64(),
    ...over,
  })
  const create = async (who: string, over: object = {}) => {
    const res = await call(who, 'POST', '/rooms', createBody(over))
    expect(res.status).toBe(201)
    return ((await res.json()) as { room: PublicRoom }).room
  }
  return { app, store, users, call, createBody, create }
}

describe('room code', () => {
  it('makes codes of the right format', () => {
    for (let i = 0; i < 50; i++) expect(isRoomCode(newRoomCode())).toBe(true)
    for (const bad of ['', 'K7Q2M9XD', 'k7q2-m9xd', 'K7Q2-M9XI', 'K7Q2-M9XD0', 'K7Q2-M9X'])
      expect(isRoomCode(bad)).toBe(false)
  })

  it('isYjsUpdate accepts an update and rejects other bytes', () => {
    expect(isYjsUpdate(tableBytes())).toBe(true)
    expect(isYjsUpdate(new Uint8Array([255, 255, 255, 1, 2, 3, 4]))).toBe(false)
  })
})

describe('POST /rooms', () => {
  it('creates a room with the host in the chosen seat', async () => {
    const { users, create, store } = await setup()
    const room = await create('alice', { side: 'red' })
    expect(room.code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/)
    expect(room.host).toBe(users.alice?.id)
    expect(room.players.blue).toBeNull()
    expect(room.players.red).toMatchObject({ id: users.alice?.id, name: 'alice' })
    expect(room.rosters).toEqual({ blue: null, red: { code: 'abc' } })
    expect(room).not.toHaveProperty('table')
    expect((await store.rooms.getTable(room.code))?.table).toEqual(tableBytes())
  })

  it('answers 401 without a token', async () => {
    const { call, createBody } = await setup()
    expect((await call(null, 'POST', '/rooms', createBody())).status).toBe(401)
  })

  it('answers 400 for a bad body', async () => {
    const { call, createBody } = await setup()
    const bad = [
      { roster: undefined },
      { roster: { code: '' } },
      { roster: { code: 'x'.repeat(1001) } },
      { mapId: 'Bad Map' },
      { mapId: 'a'.repeat(65) },
      { side: 'green' },
      { table: undefined },
    ]
    for (const over of bad) {
      const res = await call('alice', 'POST', '/rooms', createBody(over))
      expect(res.status).toBe(400)
    }
  })

  it('answers 400 Invalid table for bad bytes', async () => {
    const { call, createBody } = await setup()
    const notUpdate = Buffer.from([255, 255, 255, 1, 2, 3, 4]).toString('base64')
    for (const table of [notUpdate, '!!!!']) {
      const res = await call('alice', 'POST', '/rooms', createBody({ table }))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Invalid table' })
    }
  })

  it('answers 413 for a table above 1 MB', async () => {
    const { call, createBody } = await setup()
    const big = Buffer.alloc(1024 * 1024 + 1).toString('base64')
    const res = await call('alice', 'POST', '/rooms', createBody({ table: big }))
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: 'Table too large' })
  })

  it('answers 409 for a second room, and works after the first is deleted', async () => {
    const { call, createBody, create } = await setup()
    const first = await create('alice')
    const res = await call('alice', 'POST', '/rooms', createBody())
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'You host a multiplayer room already. Delete it first.',
    })
    expect((await call('alice', 'DELETE', `/rooms/${first.code}`)).status).toBe(204)
    expect((await call('alice', 'POST', '/rooms', createBody())).status).toBe(201)
  })
})

describe('GET /rooms', () => {
  it('answers 401 without a token', async () => {
    const { call } = await setup()
    expect((await call(null, 'GET', '/rooms')).status).toBe(401)
  })

  it('lists rooms as host and as guest, last changed first, without table', async () => {
    const { call, create, users, store } = await setup()
    const hosted = await create('alice')
    const other = await create('bob', { side: 'red' })
    const join = await call('alice', 'POST', `/rooms/${other.code}/join`, { roster: { code: 'z' } })
    expect(join.status).toBe(200)
    // Make the order certain.
    await store.rooms.replaceTable(hosted.code, 0, tableBytes(), new Date(Date.now() + 60_000))
    const res = await call('alice', 'GET', '/rooms')
    const { rooms } = (await res.json()) as { rooms: PublicRoom[] }
    expect(rooms.map((r) => r.code)).toEqual([hosted.code, other.code])
    expect(rooms[1]?.players.red).toMatchObject({ id: users.bob?.id, name: 'bob', avatar: null })
    expect(rooms[1]?.players.blue).toMatchObject({ id: users.alice?.id, name: 'alice' })
    expect(JSON.stringify(rooms)).not.toContain('"table"')
    const bob = (await (await call('bob', 'GET', '/rooms')).json()) as { rooms: PublicRoom[] }
    expect(bob.rooms.map((r) => r.code)).toEqual([other.code])
  })

  it('leaves out and deletes a room whose host is gone', async () => {
    const { call, create, store, users } = await setup()
    const room = await create('alice')
    await call('bob', 'POST', `/rooms/${room.code}/join`, { roster: { code: 'z' } })
    await store.users.delete(users.alice?.id ?? '')
    const { rooms } = (await (await call('bob', 'GET', '/rooms')).json()) as { rooms: PublicRoom[] }
    expect(rooms).toEqual([])
    expect(await store.rooms.get(room.code)).toBeNull()
  })
})

describe('GET /rooms/{code}', () => {
  it('works without a token', async () => {
    const { call, create } = await setup()
    const room = await create('alice')
    const res = await call(null, 'GET', `/rooms/${room.code}`)
    expect(res.status).toBe(200)
    expect(((await res.json()) as { room: PublicRoom }).room).toEqual(room)
  })

  it('answers 404 for a bad format and an unknown code', async () => {
    const { call } = await setup()
    for (const code of ['nope', 'AAAA-AAAA', 'K7Q2-M9XI']) {
      const res = await call(null, 'GET', `/rooms/${code}`)
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Room not found' })
    }
  })

  it('answers 404 and deletes the room when the host is gone', async () => {
    const { call, create, store, users } = await setup()
    const room = await create('alice')
    await store.users.delete(users.alice?.id ?? '')
    expect((await call(null, 'GET', `/rooms/${room.code}`)).status).toBe(404)
    expect(await store.rooms.get(room.code)).toBeNull()
  })
})

describe('POST /rooms/{code}/join', () => {
  it('takes the free seat with the roster', async () => {
    const { call, create, users } = await setup()
    const room = await create('alice')
    const res = await call('bob', 'POST', `/rooms/${room.code}/join`, { roster: { code: 'bobs' } })
    expect(res.status).toBe(200)
    const joined = ((await res.json()) as { room: PublicRoom }).room
    expect(joined.players.red).toMatchObject({ id: users.bob?.id, name: 'bob' })
    expect(joined.rosters).toEqual({ blue: { code: 'abc' }, red: { code: 'bobs' } })
  })

  it('answers 200 and changes nothing when the user has a seat', async () => {
    const { call, create } = await setup()
    const room = await create('alice')
    const first = await call('bob', 'POST', `/rooms/${room.code}/join`, { roster: { code: 'one' } })
    const again = await call('bob', 'POST', `/rooms/${room.code}/join`, { roster: { code: 'two' } })
    expect(again.status).toBe(200)
    expect(await again.json()).toEqual(await first.json())
    const host = await call('alice', 'POST', `/rooms/${room.code}/join`, { roster: { code: 'x' } })
    expect(host.status).toBe(200)
    const body = (await host.json()) as { room: PublicRoom }
    expect(body.room.rosters.blue).toEqual({ code: 'abc' })
  })

  it('answers 409 for a third user', async () => {
    const { call, create } = await setup()
    const room = await create('alice')
    await call('bob', 'POST', `/rooms/${room.code}/join`, { roster: { code: 'b' } })
    const res = await call('carol', 'POST', `/rooms/${room.code}/join`, { roster: { code: 'c' } })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'This room has two players already' })
  })

  it('answers 400, 401 and 404', async () => {
    const { call, create } = await setup()
    const room = await create('alice')
    expect((await call('bob', 'POST', `/rooms/${room.code}/join`, {})).status).toBe(400)
    expect(
      (await call('bob', 'POST', `/rooms/${room.code}/join`, { roster: { code: '' } })).status,
    ).toBe(400)
    expect(
      (await call(null, 'POST', `/rooms/${room.code}/join`, { roster: { code: 'b' } })).status,
    ).toBe(401)
    expect(
      (await call('bob', 'POST', '/rooms/AAAA-AAAA/join', { roster: { code: 'b' } })).status,
    ).toBe(404)
  })

  it('shows a deleted guest as gone and keeps the seat taken', async () => {
    const { call, create, store, users } = await setup()
    const room = await create('alice')
    await call('bob', 'POST', `/rooms/${room.code}/join`, { roster: { code: 'b' } })
    await store.users.delete(users.bob?.id ?? '')
    const got = (
      (await (await call(null, 'GET', `/rooms/${room.code}`)).json()) as {
        room: PublicRoom
      }
    ).room
    expect(got.players.red).toEqual({ id: users.bob?.id, gone: true })
    const res = await call('carol', 'POST', `/rooms/${room.code}/join`, { roster: { code: 'c' } })
    expect(res.status).toBe(409)
  })
})

describe('DELETE /rooms/{code}', () => {
  it('lets the host delete, then answers 404, and the room leaves the guest list', async () => {
    const { call, create } = await setup()
    const room = await create('alice')
    await call('bob', 'POST', `/rooms/${room.code}/join`, { roster: { code: 'b' } })
    expect((await call('alice', 'DELETE', `/rooms/${room.code}`)).status).toBe(204)
    const again = await call('alice', 'DELETE', `/rooms/${room.code}`)
    expect(again.status).toBe(404)
    const { rooms } = (await (await call('bob', 'GET', '/rooms')).json()) as { rooms: PublicRoom[] }
    expect(rooms).toEqual([])
  })

  it('answers 403 for the guest and for a stranger, 401 without a token', async () => {
    const { call, create } = await setup()
    const room = await create('alice')
    await call('bob', 'POST', `/rooms/${room.code}/join`, { roster: { code: 'b' } })
    for (const who of ['bob', 'carol']) {
      const res = await call(who, 'DELETE', `/rooms/${room.code}`)
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'Only the host can do this' })
    }
    expect((await call(null, 'DELETE', `/rooms/${room.code}`)).status).toBe(401)
    expect((await call('alice', 'GET', '/rooms')).status).toBe(200)
  })
})
