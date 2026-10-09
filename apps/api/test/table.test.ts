import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addUser, makeApp, tableEntries, tableUpdate } from './helpers'
import { createMemoryStore } from '../src/stores/memory'
import type { PublicRoom, Store } from '../src/stores/store'

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

const start = tableUpdate({ mapId: 'vibranium-heist' })

async function setup(store: Store = createMemoryStore()) {
  const { app } = makeApp(store)
  const alice = await addUser(store, 'alice')
  const bob = await addUser(store, 'bob')
  const carol = await addUser(store, 'carol')
  const res = await app.request('/rooms', {
    method: 'POST',
    headers: { ...alice.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mapId: 'vibranium-heist',
      side: 'blue',
      roster: { code: 'abc' },
      table: Buffer.from(start).toString('base64'),
    }),
  })
  const code = ((await res.json()) as { room: PublicRoom }).room.code
  await app.request(`/rooms/${code}/join`, {
    method: 'POST',
    headers: { ...bob.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ roster: { code: 'xyz' } }),
  })
  const get = (who: { headers: Record<string, string> } | null, c = code) =>
    app.request(`/rooms/${c}/table`, { headers: who?.headers })
  const put = (who: { headers: Record<string, string> } | null, body: Uint8Array, c = code) =>
    app.request(`/rooms/${c}/table`, {
      method: 'PUT',
      headers: { ...who?.headers, 'Content-Type': 'application/octet-stream' },
      body: Buffer.from(body),
    })
  const entries = async () => tableEntries(new Uint8Array(await (await get(alice)).arrayBuffer()))
  return { app, store, alice, bob, carol, code, get, put, entries }
}

describe('table routes', () => {
  it('GET gives the bytes of the start table', async () => {
    const { get, alice, bob } = await setup()
    for (const who of [alice, bob]) {
      const res = await get(who)
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/octet-stream')
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(start)
    }
  })

  it('answers 401, 403 and 404', async () => {
    const { get, put, carol, alice } = await setup()
    expect((await get(null)).status).toBe(401)
    expect((await put(null, start)).status).toBe(401)
    const noSeat = await get(carol)
    expect(noSeat.status).toBe(403)
    expect(await noSeat.json()).toEqual({ error: 'No seat in this room' })
    expect((await put(carol, start)).status).toBe(403)
    expect((await get(alice, 'AAAA-AAAA')).status).toBe(404)
    expect((await put(alice, start, 'AAAA-AAAA')).status).toBe(404)
    expect((await get(alice, 'bad')).status).toBe(404)
  })

  it('PUT then GET has the start table and the change', async () => {
    const { put, get, entries, bob, alice } = await setup()
    const res = await put(bob, tableUpdate({ cardA: 'moved' }))
    expect(res.status).toBe(204)
    expect(await entries()).toEqual({ mapId: 'vibranium-heist', cardA: 'moved' })
    expect((await get(bob)).status).toBe(200)
    expect((await put(alice, tableUpdate({ cardB: 'x' }))).status).toBe(204)
    expect(await entries()).toEqual({ mapId: 'vibranium-heist', cardA: 'moved', cardB: 'x' })
  })

  it('answers 400 for bytes that are not a Yjs update', async () => {
    const { put, alice, entries } = await setup()
    for (const body of [
      new Uint8Array([255, 255, 255, 255, 255]),
      new TextEncoder().encode('{}'),
    ]) {
      const res = await put(alice, body)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Invalid table' })
    }
    expect(await entries()).toEqual({ mapId: 'vibranium-heist' })
  })

  it('answers 413 for a body above 1 MB', async () => {
    const { put, alice } = await setup()
    const res = await put(alice, new Uint8Array(1024 * 1024 + 1))
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: 'Table too large' })
  })

  it('answers 413 and writes nothing when the merged table is above 1 MB', async () => {
    const { put, alice, bob, store, code } = await setup()
    // Two updates under 1 MB each, which are bigger together.
    const big = (k: string) => tableUpdate({ [k]: 'x'.repeat(600 * 1024) })
    expect((await put(alice, big('a'))).status).toBe(204)
    const before = await store.rooms.getTable(code)
    const res = await put(bob, big('b'))
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: 'Table too large' })
    expect(await store.rooms.getTable(code)).toEqual(before)
  })

  it('keeps both changes of two writes at the same time', async () => {
    const base = createMemoryStore()
    let hook: (() => unknown) | null = null
    const store: Store = {
      ...base,
      rooms: {
        ...base.rooms,
        // Runs the other write after the read and before the write of the first one.
        getTable: async (c) => {
          const read = await base.rooms.getTable(c)
          const h = hook
          hook = null
          if (h) await h()
          return read
        },
      },
    }
    const { put, entries, alice, bob, code } = await setup(store)
    const before = await base.rooms.get(code)
    hook = () => put(bob, tableUpdate({ fromBob: '1' }))
    const res = await put(alice, tableUpdate({ fromAlice: '1' }))
    expect(res.status).toBe(204)
    expect(await entries()).toEqual({ mapId: 'vibranium-heist', fromAlice: '1', fromBob: '1' })
    const after = await base.rooms.get(code)
    expect(after?.tableRev).toBe(2)
    expect(after?.updatedAt.getTime()).toBeGreaterThanOrEqual(before?.updatedAt.getTime() ?? 0)
  })

  it('answers 409 when the second try fails too', async () => {
    const base = createMemoryStore()
    const store: Store = {
      ...base,
      rooms: { ...base.rooms, replaceTable: async () => false },
    }
    const { put, alice } = await setup(store)
    const res = await put(alice, tableUpdate({ a: '1' }))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'The table changed. Try again.' })
  })

  it('moves tableRev and updatedAt on a write', async () => {
    const { put, alice, store, code } = await setup()
    const before = await store.rooms.get(code)
    await new Promise((r) => setTimeout(r, 5))
    await put(alice, tableUpdate({ a: '1' }))
    const after = await store.rooms.get(code)
    expect(after?.tableRev).toBe(1)
    expect(after?.updatedAt.getTime()).toBeGreaterThan(before?.updatedAt.getTime() ?? 0)
  })

  it('answers 404 after the host deleted the room', async () => {
    const { app, put, get, alice, bob, code } = await setup()
    await app.request(`/rooms/${code}`, { method: 'DELETE', headers: alice.headers })
    expect((await put(bob, tableUpdate({ a: '1' }))).status).toBe(404)
    expect((await get(bob)).status).toBe(404)
  })

  it('logs sizes and no token', async () => {
    const { put, alice } = await setup()
    const log = vi.mocked(console.log)
    log.mockClear()
    await put(alice, tableUpdate({ a: '1' }))
    const lines = log.mock.calls.map((a) => String(a[0]))
    expect(lines.some((l) => /^table write body=\d+ merged=\d+$/.test(l))).toBe(true)
    expect(lines.join('\n')).not.toContain('Bearer')
  })
})
