import { describe, expect, it, vi } from 'vitest'
import { createSeatCache } from '../src/rooms/seats'
import { createMemoryStore } from '../src/stores/memory'

async function setup() {
  const store = createMemoryStore()
  const room = await store.rooms.create(
    { host: 'u_a', mapId: 'm', roster: { code: 'a' }, table: new Uint8Array([1]) },
    new Date(),
  )
  const get = vi.spyOn(store.rooms, 'get')
  let t = 1000
  const cache = createSeatCache(store, { ttl: 30_000, now: () => t })
  return { store, room, get, cache, advance: (ms: number) => (t += ms) }
}

describe('seat cache', () => {
  it('reads the store once for two calls within 30 s, then again after 30 s', async () => {
    const { room, get, cache, advance } = await setup()
    expect(await cache.seats(room._id, 'u_a')).toEqual({ host: 'u_a', guest: null })
    advance(29_000)
    expect(await cache.seats(room._id, 'u_a')).toEqual({ host: 'u_a', guest: null })
    expect(get).toHaveBeenCalledTimes(1)
    advance(2_000)
    await cache.seats(room._id, 'u_a')
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('reads the store again when the cached entry gives the user no seat', async () => {
    const { store, room, get, cache } = await setup()
    expect(await cache.seats(room._id, 'u_b')).toEqual({ host: 'u_a', guest: null })
    await store.rooms.join(room._id, 'guest', 'u_b', { code: 'b' }, new Date())
    expect(await cache.seats(room._id, 'u_b')).toEqual({ host: 'u_a', guest: 'u_b' })
    expect(get).toHaveBeenCalledTimes(2)
    // Now u_b is seated: the cached answer is used.
    await cache.seats(room._id, 'u_b')
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('answers null for an unknown room', async () => {
    const { get, cache } = await setup()
    expect(await cache.seats('AAAA-AAAA', 'u_a')).toBeNull()
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('does not read the store for a bad code', async () => {
    const { get, cache } = await setup()
    for (const bad of ['', 'nope', 'aaaa-aaaa', 'AAAA-AAAI'])
      expect(await cache.seats(bad, 'u_a')).toBeNull()
    expect(get).not.toHaveBeenCalled()
  })
})
