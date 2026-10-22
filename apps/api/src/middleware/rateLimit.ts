import type { Context } from 'hono'

const WINDOW_MS = 60_000
// The map holds at most this many IPs.
const MAX_TRACKED = 2000

// The address of the caller. Lambda function URL: requestContext.http.sourceIp. Node server: the socket.
// Not stored, only the key of the rate limit in memory.
export function callerIp(c: Context): string {
  const env = c.env as {
    requestContext?: { http?: { sourceIp?: string } }
    incoming?: { socket?: { remoteAddress?: string } }
  } | null
  return env?.requestContext?.http?.sourceIp ?? env?.incoming?.socket?.remoteAddress ?? 'unknown'
}

// Per IP, per instance, fixed window. A cold instance starts empty: this is a brake, not a wall.
export function createRateLimit(limit: number, now: () => number = Date.now) {
  const hits = new Map<string, { start: number; count: number }>()
  return (ip: string): boolean => {
    const t = now()
    const entry = hits.get(ip)
    if (entry && t - entry.start < WINDOW_MS) {
      entry.count += 1
      return entry.count <= limit
    }
    if (hits.size >= MAX_TRACKED) {
      for (const [key, e] of hits) if (t - e.start >= WINDOW_MS) hits.delete(key)
      // Still full: drop the oldest entries (Map keeps insertion order).
      for (const key of hits.keys()) {
        if (hits.size < MAX_TRACKED) break
        hits.delete(key)
      }
    }
    hits.delete(ip)
    hits.set(ip, { start: t, count: 1 })
    return true
  }
}
