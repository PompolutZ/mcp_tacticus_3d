import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { createMemoryStore } from '../src/stores/memory'
import { makeApp, testConfig } from './helpers'

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

const post = (app: ReturnType<typeof makeApp>['app'], body: unknown) =>
  app.request('/auth/dev', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

type Login = { token: string; user: { id: string; discordId: string; name: string } }

describe('POST /auth/dev', () => {
  it('returns a token and a user that work on GET /me', async () => {
    const { app } = makeApp()
    const res = await post(app, { name: ' bob ' })
    expect(res.status).toBe(200)
    const { token, user } = (await res.json()) as Login
    expect(user).toMatchObject({ discordId: 'dev:bob', username: 'bob', name: 'bob', avatar: null })
    const me = await app.request('/me', { headers: { Authorization: `Bearer ${token}` } })
    expect(me.status).toBe(200)
  })

  it('gives the same id for the same name', async () => {
    const { app } = makeApp()
    const a = (await (await post(app, { name: 'bob' })).json()) as Login
    const b = (await (await post(app, { name: 'bob' })).json()) as Login
    const c = (await (await post(app, { name: 'amy' })).json()) as Login
    expect(b.user.id).toBe(a.user.id)
    expect(c.user.id).not.toBe(a.user.id)
  })

  it('answers 400 for an empty, a long or a missing name', async () => {
    const { app } = makeApp()
    for (const body of [{ name: '' }, { name: '   ' }, { name: 'x'.repeat(33) }, {}]) {
      const res = await post(app, body)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Invalid request' })
    }
  })

  it('is not in createApp', async () => {
    const app = createApp({ store: createMemoryStore(), config: testConfig, discord: null })
    expect((await post(app, { name: 'bob' })).status).toBe(404)
  })
})
