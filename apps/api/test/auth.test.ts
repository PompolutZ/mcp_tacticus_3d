import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { DiscordError, type DiscordClient } from '../src/auth/discord'
import { createMemoryStore } from '../src/stores/memory'
import type { DiscordProfile } from '../src/stores/store'
import { testConfig } from './helpers'

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

function setup(opts: { profile?: DiscordProfile; fail?: DiscordError } = {}) {
  const state = { profile: opts.profile ?? profileOf('Bob') }
  const discord: DiscordClient = {
    async exchangeCode() {
      if (opts.fail) throw opts.fail
      return 'at'
    },
    async getProfile() {
      return state.profile
    },
  }
  const app = createApp({ store: createMemoryStore(), config: testConfig, discord })
  return { app, state }
}

const profileOf = (name: string): DiscordProfile => ({
  discordId: '80351110224678912',
  username: 'bob',
  name,
  avatar: null,
})

const post = (app: ReturnType<typeof setup>['app'], body: unknown) =>
  app.request('/auth/discord', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const good = { code: 'secret-code-123', redirectUri: 'http://localhost:5173/' }
type Login = { token: string; user: { id: string; name: string; discordId: string } }

describe('POST /auth/discord', () => {
  it('creates a user, and the token works on GET /me', async () => {
    const { app } = setup()
    const res = await post(app, good)
    expect(res.status).toBe(200)
    const { token, user } = (await res.json()) as Login
    expect(user).toMatchObject({ discordId: '80351110224678912', name: 'Bob' })
    const me = await app.request('/me', { headers: { Authorization: `Bearer ${token}` } })
    expect(me.status).toBe(200)
  })

  it('updates the name and keeps the id on a second login', async () => {
    const { app, state } = setup()
    const first = (await (await post(app, good)).json()) as Login
    state.profile = profileOf('Robert')
    const second = (await (await post(app, good)).json()) as Login
    expect(second.user.id).toBe(first.user.id)
    expect(second.user.name).toBe('Robert')
  })

  it('answers 401 when Discord rejects the code', async () => {
    const { app } = setup({ fail: new DiscordError('rejected') })
    const res = await post(app, good)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Discord login failed' })
  })

  it('answers 502 when Discord is not available', async () => {
    const { app } = setup({ fail: new DiscordError('unavailable') })
    const res = await post(app, good)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'Discord is not available' })
  })

  it.each([
    {},
    { code: '', redirectUri: 'http://x/' },
    { code: 'c'.repeat(201), redirectUri: 'http://x/' },
    { code: 'c', redirectUri: 'ftp://x/' },
    { code: 'c', redirectUri: 'not a url' },
    { code: 'c', redirectUri: `http://x/${'a'.repeat(200)}` },
  ])('answers 400 for a bad body %#', async (body) => {
    const { app } = setup()
    const res = await post(app, body)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid request' })
  })

  it('answers 503 without a Discord client', async () => {
    const app = createApp({ store: createMemoryStore(), config: testConfig, discord: null })
    expect((await post(app, good)).status).toBe(503)
  })

  it('does not log the code', async () => {
    const { app } = setup()
    await post(app, good)
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain('secret-code-123')
  })
})
