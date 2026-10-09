import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { signSession } from '../src/auth/token'
import type { DiscordProfile } from '../src/stores/store'
import { makeApp, testConfig } from './helpers'

const profile: DiscordProfile = { discordId: '1', username: 'nelly', name: 'Nelly', avatar: null }
const DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })

describe('/me', () => {
  it('answers 401 without a header, with a bad token and with a deleted user', async () => {
    const { app, store } = makeApp()
    const user = await store.users.upsertDiscord(profile, new Date())
    const token = await signSession(user._id, testConfig.sessionSecret, new Date())
    for (const init of [{}, auth('bad'), { headers: { Authorization: token } }]) {
      const res = await app.request('/me', init)
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'Not logged in' })
    }
    await store.users.delete(user._id)
    expect((await app.request('/me', auth(token))).status).toBe(401)
  })

  it('GET returns the user and no token when iat is new', async () => {
    const { app, store } = makeApp()
    const user = await store.users.upsertDiscord(profile, new Date())
    const token = await signSession(user._id, testConfig.sessionSecret, new Date())
    const res = await app.request('/me', auth(token))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      user: { id: user._id, discordId: '1', username: 'nelly', name: 'Nelly', avatar: null },
    })
  })

  it('GET renews the token and moves expiresAt when iat is older than 1 day', async () => {
    const { app, store } = makeApp()
    const old = new Date(Date.now() - 2 * DAY)
    const user = await store.users.upsertDiscord(profile, old)
    const token = await signSession(user._id, testConfig.sessionSecret, old)
    const res = await app.request('/me', auth(token))
    const body = (await res.json()) as { token?: string }
    expect(typeof body.token).toBe('string')
    expect((await app.request('/me', auth(body.token ?? ''))).status).toBe(200)
    const after = await store.users.get(user._id)
    expect(after?.expiresAt.getTime()).toBeGreaterThan(user.expiresAt.getTime() + DAY)
  })

  it('DELETE returns 204, then GET returns 401', async () => {
    const { app, store } = makeApp()
    const user = await store.users.upsertDiscord(profile, new Date())
    const token = await signSession(user._id, testConfig.sessionSecret, new Date())
    const res = await app.request('/me', { method: 'DELETE', ...auth(token) })
    expect(res.status).toBe(204)
    expect((await app.request('/me', auth(token))).status).toBe(401)
  })

  it('DELETE removes the hosted room and keeps a guest seat as gone', async () => {
    const { app, store } = makeApp()
    const user = await store.users.upsertDiscord(profile, new Date())
    const other = await store.users.upsertDiscord({ ...profile, discordId: '2' }, new Date())
    const token = await signSession(user._id, testConfig.sessionSecret, new Date())
    const table = new Uint8Array([0, 0])
    const mine = await store.rooms.create(
      { host: user._id, side: 'blue', mapId: 'm', roster: { code: 'a' }, table },
      new Date(),
    )
    const theirs = await store.rooms.create(
      { host: other._id, side: 'blue', mapId: 'm', roster: { code: 'b' }, table },
      new Date(),
    )
    await store.rooms.join(theirs._id, 'red', user._id, { code: 'a' }, new Date())
    const res = await app.request('/me', { method: 'DELETE', ...auth(token) })
    expect(res.status).toBe(204)
    expect(await store.rooms.get(mine._id)).toBeNull()
    const got = await app.request(`/rooms/${theirs._id}`)
    const body = (await got.json()) as { room: { players: { red: unknown } } }
    expect(body.room.players.red).toEqual({ id: user._id, gone: true })
  })
})
