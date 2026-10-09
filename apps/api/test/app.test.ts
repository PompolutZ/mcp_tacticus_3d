import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { createMemoryStore } from '../src/stores/memory'
import type { Store } from '../src/stores/store'
import { testConfig } from './helpers'

function makeApp() {
  const app = createApp({ store: createMemoryStore(), config: testConfig, discord: null })
  const extra = new Hono()
  extra.get('/boom', () => {
    throw new Error('secret')
  })
  extra.get('/forbidden', () => {
    throw new HTTPException(403, { message: 'No seat' })
  })
  // Routes added after createApp still get the handlers of the app.
  app.route('/', extra)
  return app
}

afterEach(() => vi.restoreAllMocks())

describe('app', () => {
  it('GET /health returns the status', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const res = await makeApp().request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, version: 'test', db: 'none' })
  })

  it('unknown route returns 404 JSON', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const res = await makeApp().request('/nothing')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found' })
  })

  it('unknown error returns 500 without the message', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await makeApp().request('/boom')
    expect(res.status).toBe(500)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ error: 'Internal server error' })
    expect(text).not.toContain('secret')
  })

  it('HTTPException returns its status and message', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const res = await makeApp().request('/forbidden')
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'No seat' })
  })

  it('logs one line per request, without the query', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await makeApp().request('/health?x=1')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]?.[0]).toMatch(/^GET \/health 200 \d+ms$/)
  })

  it('GET /health returns 503 when the database ping fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const store: Store = { ...createMemoryStore(), ping: async () => 'error' }
    const res = await createApp({ store, config: testConfig, discord: null }).request('/health')
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, version: 'test', db: 'error' })
  })
})
