import { describe, expect, it } from 'vitest'
import { createRateLimit } from '../src/routes/errors'
import { makeApp } from './helpers'

const good = {
  message: 'boom',
  stack: 'Error: boom\n at a (https://x/y.js:1:2)',
  version: 'abc123',
  agent: 'Mozilla/5.0',
  room: 'ABCD12',
  side: 'host' as const,
}

function setup() {
  const { app, store } = makeApp()
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    app.request('/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  return { app, store, post }
}

describe('POST /errors', () => {
  it('stores a good report with the server time, with no login', async () => {
    const { store, post } = setup()
    const before = Date.now()
    const res = await post(good)
    expect(res.status).toBe(204)
    const [saved] = await store.errors.latest(5)
    expect(saved).toMatchObject(good)
    expect(saved?.time.getTime()).toBeGreaterThanOrEqual(before)
  })

  it('accepts a report without room and side', async () => {
    const { store, post } = setup()
    const { room: _room, side: _side, ...rest } = good
    expect((await post(rest)).status).toBe(204)
    const [saved] = await store.errors.latest(1)
    expect(saved).not.toHaveProperty('room')
    expect(saved).not.toHaveProperty('side')
  })

  it('refuses an unknown field', async () => {
    const { store, post } = setup()
    expect((await post({ ...good, extra: 'x' })).status).toBe(400)
    expect(await store.errors.latest(5)).toEqual([])
  })

  it('refuses a wrong type, a long field, a bad side and bad JSON', async () => {
    const { post } = setup()
    expect((await post({ ...good, message: 5 })).status).toBe(400)
    expect((await post({ ...good, message: 'x'.repeat(501) })).status).toBe(400)
    expect((await post({ ...good, stack: 'x'.repeat(8001) })).status).toBe(400)
    expect((await post({ ...good, side: 'other' })).status).toBe(400)
    expect((await post({ ...good, room: 'x'.repeat(17) })).status).toBe(400)
    expect((await post('{nope')).status).toBe(400)
  })

  it('refuses a body over 16 KB, also with a wrong Content-Length', async () => {
    const { store, post } = setup()
    const big = JSON.stringify({ ...good, stack: 'x'.repeat(20_000) })
    expect((await post(big)).status).toBe(413)
    // Content-Length says small, the real body is big: the real size counts.
    const lie = await post(big, { 'Content-Length': '100' })
    expect([400, 413]).toContain(lie.status)
    expect(await store.errors.latest(5)).toEqual([])
  })

  it('never lets a $ key reach the store', async () => {
    const { store, post } = setup()
    expect((await post({ ...good, $set: { a: 1 } })).status).toBe(400)
    expect((await post({ ...good, message: { $gt: '' } })).status).toBe(400)
    expect(await store.errors.latest(5)).toEqual([])
    expect((await post(good)).status).toBe(204)
    const [saved] = await store.errors.latest(1)
    expect(Object.keys(saved ?? {}).sort()).toEqual(
      ['agent', 'message', 'room', 'side', 'stack', 'time', 'version'].sort(),
    )
  })

  it('answers 429 after 20 reports a minute from one address', async () => {
    const { post } = setup()
    for (let i = 0; i < 20; i++) expect((await post(good)).status).toBe(204)
    expect((await post(good)).status).toBe(429)
  })
})

describe('rate limit', () => {
  it('starts a new window after a minute, and keeps the map bounded', () => {
    let t = 0
    const allow = createRateLimit(2, () => t)
    expect([allow('a'), allow('a'), allow('a')]).toEqual([true, true, false])
    expect(allow('b')).toBe(true)
    t = 60_000
    expect(allow('a')).toBe(true)
    for (let i = 0; i < 5000; i++) allow(`ip${i}`)
    expect(allow('late')).toBe(true)
  })
})

describe('memory store', () => {
  it('keeps the last 200 reports, newest first', async () => {
    const { store } = setup()
    for (let i = 0; i < 205; i++) {
      await store.errors.add({ ...good, time: new Date(i), message: `m${i}` })
    }
    const all = await store.errors.latest(1000)
    expect(all).toHaveLength(200)
    expect(all[0]?.message).toBe('m204')
    expect(all.at(-1)?.message).toBe('m5')
  })
})
