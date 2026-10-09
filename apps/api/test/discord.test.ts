import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createDiscordClient, DiscordError } from '../src/auth/discord'

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

const cfg = { clientId: 'cid', clientSecret: 'csec' }
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function fake(res: Response | Error) {
  const calls: { url: string; init: RequestInit }[] = []
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    if (res instanceof Error) throw res
    return res
  }) as unknown as typeof fetch
  return { fetchFn, calls }
}

const kindOf = async (p: Promise<unknown>) => {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  )
  return err instanceof DiscordError ? err.kind : 'other'
}

describe('exchangeCode', () => {
  it('posts a form body and returns the access token', async () => {
    const { fetchFn, calls } = fake(json({ access_token: 'at' }))
    const token = await createDiscordClient(cfg, fetchFn).exchangeCode('the-code', 'http://x/')
    expect(token).toBe('at')
    expect(calls[0]?.url).toBe('https://discord.com/api/v10/oauth2/token')
    expect(calls[0]?.init.method).toBe('POST')
    expect(calls[0]?.init.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' })
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal)
    const body = new URLSearchParams(String(calls[0]?.init.body))
    expect(Object.fromEntries(body)).toEqual({
      grant_type: 'authorization_code',
      code: 'the-code',
      redirect_uri: 'http://x/',
      client_id: 'cid',
      client_secret: 'csec',
    })
  })

  it.each([400, 401])('maps Discord %i to rejected', async (status) => {
    const { fetchFn } = fake(json({ error: 'invalid_grant' }, status))
    expect(await kindOf(createDiscordClient(cfg, fetchFn).exchangeCode('c', 'http://x/'))).toBe(
      'rejected',
    )
  })

  it.each([429, 500])('maps Discord %i to unavailable', async (status) => {
    const { fetchFn } = fake(json({}, status))
    expect(await kindOf(createDiscordClient(cfg, fetchFn).exchangeCode('c', 'http://x/'))).toBe(
      'unavailable',
    )
  })

  it('maps a timeout and a network error to unavailable', async () => {
    for (const err of [new DOMException('t', 'TimeoutError'), new TypeError('fetch failed')]) {
      const { fetchFn } = fake(err)
      expect(await kindOf(createDiscordClient(cfg, fetchFn).exchangeCode('c', 'http://x/'))).toBe(
        'unavailable',
      )
    }
  })

  it('maps an answer without access_token to unavailable', async () => {
    const { fetchFn } = fake(json({}))
    expect(await kindOf(createDiscordClient(cfg, fetchFn).exchangeCode('c', 'http://x/'))).toBe(
      'unavailable',
    )
  })

  it('logs the status only', async () => {
    const { fetchFn } = fake(json({ error: 'SECRET-BODY' }, 400))
    await kindOf(createDiscordClient(cfg, fetchFn).exchangeCode('the-code', 'http://x/'))
    const logged = JSON.stringify(vi.mocked(console.log).mock.calls)
    expect(logged).not.toContain('SECRET-BODY')
    expect(logged).not.toContain('the-code')
  })
})

describe('getProfile', () => {
  it('sends the Bearer header and maps the profile', async () => {
    const { fetchFn, calls } = fake(
      json({ id: '1', username: 'bob', global_name: 'Bob B', avatar: 'abc' }),
    )
    const p = await createDiscordClient(cfg, fetchFn).getProfile('at')
    expect(calls[0]?.url).toBe('https://discord.com/api/v10/users/@me')
    expect(calls[0]?.init.headers).toEqual({ Authorization: 'Bearer at' })
    expect(p).toEqual({ discordId: '1', username: 'bob', name: 'Bob B', avatar: 'abc' })
  })

  it('uses the username and a null avatar when global_name and avatar are null', async () => {
    const { fetchFn } = fake(json({ id: '1', username: 'bob', global_name: null, avatar: null }))
    const p = await createDiscordClient(cfg, fetchFn).getProfile('at')
    expect(p).toEqual({ discordId: '1', username: 'bob', name: 'bob', avatar: null })
  })

  it('maps a profile without id and a 500 to unavailable', async () => {
    for (const res of [json({ username: 'bob' }), json({}, 500)]) {
      const { fetchFn } = fake(res)
      expect(await kindOf(createDiscordClient(cfg, fetchFn).getProfile('at'))).toBe('unavailable')
    }
  })
})
