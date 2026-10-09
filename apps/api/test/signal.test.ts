import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isMessageId, newMessageId } from '../src/routes/signal'
import { addUser, makeApp } from './helpers'

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

type Msg = { id: string; from: string; to: string; type: string; data: string; user: unknown }

async function setup() {
  const { app, store } = makeApp()
  const alice = await addUser(store, 'alice')
  const bob = await addUser(store, 'bob')
  const carol = await addUser(store, 'carol')
  const room = await store.rooms.create(
    { host: alice.id, side: 'blue', mapId: 'm', roster: { code: 'a' }, table: new Uint8Array([1]) },
    new Date(),
  )
  await store.rooms.join(room._id, 'red', bob.id, { code: 'b' }, new Date())
  const path = `/rooms/${room._id}/messages`
  const post = (who: { headers: object } | null, body: unknown, code = room._id) =>
    app.request(`/rooms/${code}/messages`, {
      method: 'POST',
      headers: { ...who?.headers, 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  const poll = (who: { headers: object } | null, to: string, after?: string, code = room._id) =>
    app.request(`/rooms/${code}/messages?to=${to}`, {
      headers: { ...who?.headers, ...(after ? { 'x-after': after } : {}) },
    })
  const list = async (who: { headers: object }, to: string, after?: string) =>
    ((await (await poll(who, to, after)).json()) as { messages: Msg[] }).messages
  return { app, store, alice, bob, carol, room, path, post, poll, list }
}

const A = 'peer-alice'
const B = 'peer-bob01'
const hello = (from: string) => ({ from, to: '*', type: 'hello', data: 'dev' })

describe('message ids', () => {
  it('has 13 digits, a dash and 8 characters, and sorts by time', () => {
    const a = newMessageId(5)
    const b = newMessageId(1_700_000_000_000)
    expect(isMessageId(a)).toBe(true)
    expect(a < b).toBe(true)
    expect(isMessageId('abc')).toBe(false)
  })
})

describe('POST and GET /rooms/{code}/messages', () => {
  it('passes a message between two seated users, with the user set by the server', async () => {
    const { alice, bob, post, list } = await setup()
    const res = await post(alice, { ...hello(A), user: { id: 'u_fake', name: 'Fake' } })
    expect(res.status).toBe(201)
    const { id } = (await res.json()) as { id: string }
    expect(isMessageId(id)).toBe(true)
    const got = await list(bob, B)
    expect(got).toEqual([
      {
        id,
        from: A,
        to: '*',
        type: 'hello',
        data: 'dev',
        user: { id: alice.id, name: 'alice', avatar: null, discordId: 'dev:alice' },
      },
    ])
  })

  it('does not return own messages or messages to another peer', async () => {
    const { alice, bob, post, list } = await setup()
    await post(alice, hello(A))
    await post(alice, { from: A, to: 'someone-else', type: 'offer', data: 'sdp' })
    expect(await list(alice, A)).toEqual([])
    expect(await list(bob, B)).toHaveLength(1)
    await post(alice, { from: A, to: B, type: 'offer', data: 'sdp' })
    expect((await list(bob, B)).map((m) => m.type)).toEqual(['hello', 'offer'])
  })

  it('returns only newer messages for x-after, the oldest first', async () => {
    const { alice, bob, post, list } = await setup()
    await post(alice, hello(A))
    const first = await list(bob, B)
    await post(alice, { from: A, to: B, type: 'offer', data: 'one' })
    await post(alice, { from: A, to: B, type: 'answer', data: 'two' })
    const next = await list(bob, B, first[0]?.id)
    expect(next.map((m) => m.data)).toEqual(['one', 'two'])
    expect(await list(bob, B, next[1]?.id)).toEqual([])
  })

  it('replaces the older messages of the same user on hello and on bye only', async () => {
    const { alice, bob, post, list, store, room } = await setup()
    await post(alice, hello(A))
    await post(bob, hello(B))
    await post(alice, { from: A, to: B, type: 'offer', data: 'sdp' })
    await post(alice, hello(A))
    const seen = await list(bob, B)
    expect(seen.map((m) => m.type)).toEqual(['hello'])
    expect(await list(alice, A)).toHaveLength(1)
    expect(await store.messages.count(room._id)).toBe(2)
    await post(alice, { from: A, to: B, type: 'offer', data: 'sdp' })
    await post(alice, { from: A, to: '*', type: 'bye', data: '' })
    expect((await list(bob, B)).map((m) => m.type)).toEqual(['bye'])
    expect((await list(alice, A)).map((m) => m.type)).toEqual(['hello'])
  })

  it('answers 400 for a bad message', async () => {
    const { alice, post } = await setup()
    const bad = [
      { ...hello(A), type: 'ice' },
      { ...hello('short') },
      { ...hello('has space here') },
      { ...hello(A), to: 'bad to' },
      { from: A, to: '*', type: 'offer', data: 'sdp' },
      { ...hello(A), data: 'x'.repeat(8 * 1024 + 1) },
      { ...hello(A), data: 5 },
      { from: A, to: '*', type: 'hello' },
      'not json',
    ]
    for (const body of bad) {
      const res = await post(alice, body)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Invalid message' })
    }
    expect((await post(alice, { ...hello(A), data: 'x'.repeat(8 * 1024) })).status).toBe(201)
  })

  it('answers 413 for a body above 16 KB', async () => {
    const { alice, post } = await setup()
    const res = await post(alice, { ...hello(A), data: 'x'.repeat(17 * 1024) })
    expect(res.status).toBe(413)
  })

  it('answers 429 for the 51st message in a room', async () => {
    const { alice, bob, post } = await setup()
    for (let i = 0; i < 25; i++) {
      expect((await post(alice, { from: A, to: B, type: 'offer', data: String(i) })).status).toBe(
        201,
      )
      expect((await post(bob, { from: B, to: A, type: 'answer', data: String(i) })).status).toBe(
        201,
      )
    }
    const res = await post(bob, { from: B, to: A, type: 'answer', data: 'x' })
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'Too many messages in this room' })
    // A hello still works: it replaces the user's messages.
    expect((await post(bob, hello(B))).status).toBe(201)
  })

  it('answers 401 without a token, 403 for a third user, 404 for an unknown room', async () => {
    const { alice, carol, post, poll } = await setup()
    expect((await post(null, hello(A))).status).toBe(401)
    expect((await poll(null, B)).status).toBe(401)
    expect((await post(carol, hello('peer-carol'))).status).toBe(403)
    expect((await poll(carol, B)).status).toBe(403)
    expect((await post(alice, hello(A), 'AAAA-AAAA')).status).toBe(404)
    expect((await poll(alice, B, undefined, 'AAAA-AAAA')).status).toBe(404)
    expect((await poll(alice, B, undefined, 'nope')).status).toBe(404)
  })

  it('answers 400 for a bad to or a bad x-after', async () => {
    const { alice, poll } = await setup()
    expect((await poll(alice, 'x')).status).toBe(400)
    expect((await poll(alice, 'bad%20peer%20id')).status).toBe(400)
    expect((await poll(alice, B, 'nope')).status).toBe(400)
    expect((await poll(alice, B, '0000000000001-aaaaaaaa')).status).toBe(200)
  })

  it('lets a guest who joined at once post, while the host poll kept the cache warm', async () => {
    const { store, alice, carol, post, poll } = await setup()
    const guest = await store.rooms.create(
      {
        host: carol.id,
        side: 'blue',
        mapId: 'm',
        roster: { code: 'c' },
        table: new Uint8Array([1]),
      },
      new Date(),
    )
    expect((await poll(carol, B, undefined, guest._id)).status).toBe(200)
    expect((await post(alice, hello(A), guest._id)).status).toBe(403)
    await store.rooms.join(guest._id, 'red', alice.id, { code: 'a' }, new Date())
    expect((await post(alice, hello(A), guest._id)).status).toBe(201)
  })

  it('does not read the user on a poll, and reads it on a post', async () => {
    const { alice, bob, store, post, poll } = await setup()
    const get = vi.spyOn(store.users, 'get')
    const many = vi.spyOn(store.users, 'getMany')
    await poll(alice, A)
    await poll(bob, B)
    expect(get).not.toHaveBeenCalled()
    expect(many).not.toHaveBeenCalled()
    await post(alice, hello(A))
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('answers 401 on a post when the user is gone, and 200 on a poll with the token', async () => {
    const { alice, store, post, poll } = await setup()
    await store.users.delete(alice.id)
    expect((await post(alice, hello(A))).status).toBe(401)
    expect((await poll(alice, A)).status).toBe(200)
  })
})
