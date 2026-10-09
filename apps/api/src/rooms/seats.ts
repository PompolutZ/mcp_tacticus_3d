import { isRoomCode } from './code'
import type { Side, Store } from '../stores/store'

export type Seats = Record<Side, string | null>

export interface SeatCache {
  // The seats of a room, or null when the room does not exist.
  // userId: the user who asks. A cached entry counts only when it gives this user a seat.
  seats(code: string, userId: string): Promise<Seats | null>
}

// Keeps the seats of a room for `ttl` ms, so a poll every 2 s reads the store rarely.
// A cached entry is used only when it gives the user a seat. Otherwise the store is
// read again, so a guest who just joined is not refused. A deleted room shows as null
// to a seated user after at most `ttl`.
export function createSeatCache(
  store: Store,
  { ttl = 30_000, now = Date.now }: { ttl?: number; now?: () => number } = {},
): SeatCache {
  const cache = new Map<string, { seats: Seats | null; until: number }>()
  return {
    async seats(code, userId) {
      if (!isRoomCode(code)) return null
      const t = now()
      const hit = cache.get(code)
      if (
        hit &&
        hit.until > t &&
        hit.seats &&
        (hit.seats.blue === userId || hit.seats.red === userId)
      )
        return hit.seats
      const room = await store.rooms.get(code)
      const seats = room ? { blue: room.players.blue, red: room.players.red } : null
      cache.set(code, { seats, until: t + ttl })
      // Drop expired entries so the map stays small.
      for (const [k, v] of cache) if (v.until <= t) cache.delete(k)
      return seats
    },
  }
}
