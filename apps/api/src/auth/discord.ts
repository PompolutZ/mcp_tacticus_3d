import type { DiscordProfile } from '../stores/store'

// Phase 2 adds createDiscordClient. The type is here so that Deps can name it.
export interface DiscordClient {
  exchangeCode(code: string, redirectUri: string): Promise<string>
  getProfile(accessToken: string): Promise<DiscordProfile>
}
