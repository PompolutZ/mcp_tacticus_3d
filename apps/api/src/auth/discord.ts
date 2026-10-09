import type { DiscordConfig } from '../config'
import type { DiscordProfile } from '../stores/store'

export interface DiscordClient {
  exchangeCode(code: string, redirectUri: string): Promise<string>
  getProfile(accessToken: string): Promise<DiscordProfile>
}

// rejected: Discord refused the code. unavailable: anything else went wrong.
export class DiscordError extends Error {
  constructor(readonly kind: 'rejected' | 'unavailable') {
    super(kind === 'rejected' ? 'Discord login failed' : 'Discord is not available')
  }
}

const API = 'https://discord.com/api/v10'
// The Lambda timeout is 10 seconds. One slow call must not use all of it.
const TIMEOUT_MS = 5000

type Fetch = typeof fetch

// The log gets the status only, never the body.
function unavailable(status?: number): DiscordError {
  console.log(`discord call failed${status ? ` status=${status}` : ''}`)
  return new DiscordError('unavailable')
}

async function call(fetchFn: Fetch, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetchFn(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw unavailable()
  }
}

export function createDiscordClient(discord: DiscordConfig, fetchFn: Fetch): DiscordClient {
  return {
    async exchangeCode(code, redirectUri) {
      const res = await call(fetchFn, `${API}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: discord.clientId,
          client_secret: discord.clientSecret,
        }),
      })
      if (res.status === 400 || res.status === 401) {
        console.log(`discord token request rejected status=${res.status}`)
        throw new DiscordError('rejected')
      }
      if (!res.ok) throw unavailable(res.status)
      const body = (await res.json().catch(() => null)) as { access_token?: unknown } | null
      if (typeof body?.access_token !== 'string' || !body.access_token) throw unavailable()
      return body.access_token
    },

    // The access token is dropped after this call.
    async getProfile(accessToken) {
      const res = await call(fetchFn, `${API}/users/@me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw unavailable(res.status)
      const p = (await res.json().catch(() => null)) as {
        id?: unknown
        username?: unknown
        global_name?: unknown
        avatar?: unknown
      } | null
      if (typeof p?.id !== 'string' || !p.id || typeof p.username !== 'string') throw unavailable()
      return {
        discordId: p.id,
        username: p.username,
        name: typeof p.global_name === 'string' && p.global_name ? p.global_name : p.username,
        avatar: typeof p.avatar === 'string' ? p.avatar : null,
      }
    },
  }
}
