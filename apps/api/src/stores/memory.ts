import type { Store } from './store'

export function createMemoryStore(): Store {
  return {
    // No database, so there is nothing to ping.
    ping: async () => 'none',
    close: async () => {},
  }
}
