import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { LIMIT_PER_MINUTE, eventRoutes } from '../src/routes/events'
import { createMemoryStore } from '../src/stores/memory'
import { MAX_VERSION, type UsageEvent } from '../src/stores/store'

const good = { name: 'room_create', kind: 'versus', version: 'abc123' }
const AGENT = 'Mozilla/5.0 (Macintosh)'

function setup() {
  const store = createMemoryStore()
  const saved: UsageEvent[] = []
  const add = store.events.add
  store.events.add = async (event) => {
    saved.push(event)
    await add(event)
  }
  let time = new Date('2026-10-22T10:00:00Z')
  const app = new Hono()
  app.route('/', eventRoutes({ store, now: () => time }))
  const post = (
    body: unknown,
    {
      ip = '1.1.1.1',
      agent = AGENT,
      headers = {},
    }: { ip?: string; agent?: string; headers?: Record<string, string> } = {},
  ) =>
    app.request(
      '/events',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': agent, ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      },
      { requestContext: { http: { sourceIp: ip } } },
    )
  return { saved, post, setTime: (t: string) => (time = new Date(t)) }
}

describe('POST /events', () => {
  it('stores a good event with no login, and keeps no IP or agent', async () => {
    const { saved, post } = setup()
    const res = await post(good, { ip: '9.8.7.6' })
    expect(res.status).toBe(204)
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject(good)
    expect(Object.keys(saved[0] ?? {}).sort()).toEqual([
      'expiresAt',
      'kind',
      'name',
      'time',
      'version',
      'visitor',
    ])
    const text = JSON.stringify(saved[0])
    expect(text).not.toContain('9.8.7.6')
    expect(text).not.toContain('Mozilla')
  })

  it('accepts an event without kind', async () => {
    const { saved, post } = setup()
    expect((await post({ name: 'app_open', version: 'v' })).status).toBe(204)
    expect(saved[0]).not.toHaveProperty('kind')
  })

  it('refuses an unknown name, kind or field, and bad JSON', async () => {
    const { saved, post } = setup()
    expect((await post({ ...good, name: 'nope' })).status).toBe(400)
    expect((await post({ ...good, kind: 'other' })).status).toBe(400)
    expect((await post({ ...good, extra: 'x' })).status).toBe(400)
    expect((await post({ ...good, version: 'x'.repeat(MAX_VERSION + 1) })).status).toBe(400)
    expect((await post({ ...good, $set: { a: 1 } })).status).toBe(400)
    expect((await post('{nope')).status).toBe(400)
    expect(saved).toEqual([])
  })

  it('refuses a big body', async () => {
    const { saved, post } = setup()
    expect((await post({ ...good, version: 'x'.repeat(2000) })).status).toBe(413)
    expect(saved).toEqual([])
  })

  it('answers 204 and stores nothing for a bot agent', async () => {
    const { saved, post } = setup()
    for (const agent of ['Googlebot/2.1', 'Some Crawler', 'Spider-Man', 'HeadlessChrome/120']) {
      expect((await post(good, { agent })).status).toBe(204)
    }
    expect(saved).toEqual([])
  })

  it('gives one visitor for the same IP and agent on one day', async () => {
    const { saved, post, setTime } = setup()
    await post(good)
    setTime('2026-10-22T23:59:00Z')
    await post({ name: 'app_open', version: 'v' })
    expect(saved[0]?.visitor).toBe(saved[1]?.visitor)
  })

  it('gives another visitor for another IP or agent', async () => {
    const { saved, post } = setup()
    await post(good)
    await post(good, { ip: '2.2.2.2' })
    await post(good, { agent: 'Other Browser' })
    expect(new Set(saved.map((e) => e.visitor)).size).toBe(3)
  })

  it('gives another visitor on the next day', async () => {
    const { saved, post, setTime } = setup()
    await post(good)
    setTime('2026-10-23T00:00:01Z')
    await post(good)
    expect(saved[0]?.visitor).not.toBe(saved[1]?.visitor)
  })

  it('answers 429 after the limit of events a minute from one address', async () => {
    const { post } = setup()
    for (let i = 0; i < LIMIT_PER_MINUTE; i++) expect((await post(good)).status).toBe(204)
    expect((await post(good)).status).toBe(429)
  })
})
