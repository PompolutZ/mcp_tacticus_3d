import { sign, verify } from 'hono/jwt'

const DAY = 24 * 60 * 60

export interface Session {
  sub: string
  iat: number
}

// Claims: sub, iat, exp = iat + 30 days. Times are in seconds.
export function signSession(userId: string, secret: string, now: Date): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000)
  return sign({ sub: userId, iat, exp: iat + 30 * DAY }, secret, 'HS256')
}

// Null for any failure: bad signature, expired, another algorithm, odd claims.
export async function verifySession(token: string, secret: string): Promise<Session | null> {
  try {
    const p = await verify(token, secret, 'HS256')
    if (typeof p.sub !== 'string' || typeof p.iat !== 'number') return null
    return { sub: p.sub, iat: p.iat }
  } catch {
    return null
  }
}
