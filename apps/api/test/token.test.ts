import { sign } from 'hono/jwt'
import { describe, expect, it } from 'vitest'
import { signSession, verifySession } from '../src/auth/token'

const now = new Date()

describe('session token', () => {
  it('round trips', async () => {
    const token = await signSession('u_1', 's', now)
    expect(await verifySession(token, 's')).toEqual({
      sub: 'u_1',
      iat: Math.floor(now.getTime() / 1000),
    })
  })

  it('fails when expired', async () => {
    const old = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000)
    expect(await verifySession(await signSession('u_1', 's', old), 's')).toBeNull()
  })

  it('fails with another secret', async () => {
    expect(await verifySession(await signSession('u_1', 's', now), 'other')).toBeNull()
  })

  it('fails with alg none', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const iat = Math.floor(now.getTime() / 1000)
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'u_1', iat, exp: iat + 100 })}.`
    expect(await verifySession(token, 's')).toBeNull()
  })

  it('fails with another algorithm', async () => {
    const iat = Math.floor(now.getTime() / 1000)
    const token = await sign({ sub: 'u_1', iat, exp: iat + 100 }, 's', 'HS384')
    expect(await verifySession(token, 's')).toBeNull()
  })

  it('fails with no sub', async () => {
    const iat = Math.floor(now.getTime() / 1000)
    const token = await sign({ iat, exp: iat + 100 }, 's', 'HS256')
    expect(await verifySession(token, 's')).toBeNull()
  })

  it('fails with garbage', async () => {
    expect(await verifySession('abc', 's')).toBeNull()
  })
})
