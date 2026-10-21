import { randomUUID } from 'node:crypto'
import { Binary, MongoClient } from 'mongodb'
import { afterAll, describe, expect, inject, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { createMongoStore } from '../src/stores/mongo'
import { HostingError, type NewRoom, type PublicRoom } from '../src/stores/store'
import { addUser, tableEntries, tableUpdate, testConfig } from './helpers'

const uri = inject('mongoUri')
const dbName = `assist3d_test_${randomUUID().slice(0, 8)}`
const store = createMongoStore({ uri, dbName })

afterAll(async () => {
  await store.close()
  const client = new MongoClient(uri)
  await client.db(dbName).dropDatabase()
  await client.close()
})

const table = new Uint8Array([1, 2, 3, 4])
const room = (host: string, over: Partial<NewRoom> = {}): NewRoom => ({
  host,
  mapId: 'vibranium-heist',
  roster: { code: 'abc' },
  table,
  ...over,
})
const t1 = new Date('2026-01-01T00:00:00Z')
const t2 = new Date('2026-02-01T00:00:00Z')

describe('mongo rooms store', () => {
  it('has the four indexes', async () => {
    await store.rooms.get('x')
    const client = new MongoClient(uri)
    const indexes = await client.db(dbName).collection('rooms').indexes()
    await client.close()
    expect(indexes.find((i) => i.key.host === 1)?.unique).toBe(true)
    expect(indexes.some((i) => i.key['players.host'] === 1)).toBe(true)
    expect(indexes.some((i) => i.key['players.guest'] === 1)).toBe(true)
    expect(indexes.find((i) => i.key.expiresAt === 1)?.expireAfterSeconds).toBe(0)
  })

  it('creates, gets without the table and getTable returns the bytes', async () => {
    const made = await store.rooms.create(room('u_a'), t1)
    expect(made).toMatchObject({ host: 'u_a', players: { host: 'u_a', guest: null }, tableRev: 0 })
    expect(made.expiresAt).toEqual(new Date('2027-01-01T00:00:00Z'))
    const got = await store.rooms.get(made._id)
    expect(got).not.toHaveProperty('table')
    expect(got?.rosters).toEqual({ host: { code: 'abc' }, guest: null })
    expect(await store.rooms.getTable(made._id)).toEqual({ table, tableRev: 0 })
    expect(await store.rooms.get('AAAA-AAAA')).toBeNull()
    expect(await store.rooms.getTable('AAAA-AAAA')).toBeNull()
  })

  it('lists for a user without the table, last changed first, with a limit', async () => {
    const a = await store.rooms.create(room('u_l1'), t1)
    const b = await store.rooms.create(room('u_l2'), t2)
    await store.rooms.join(a._id, 'guest', 'u_l3', { code: 'x' }, t1)
    await store.rooms.join(b._id, 'guest', 'u_l3', { code: 'y' }, t2)
    const list = await store.rooms.listForUser('u_l3', 10)
    expect(list.map((r) => r._id)).toEqual([b._id, a._id])
    for (const r of list) expect(r).not.toHaveProperty('table')
    expect(await store.rooms.listForUser('u_l3', 1)).toHaveLength(1)
    expect(await store.rooms.listForUser('u_nobody', 10)).toEqual([])
  })

  it('ignores a record of the old shape and clears it when its host creates a room', async () => {
    const client = new MongoClient(uri)
    await client
      .db(dbName)
      .collection<{ _id: string; [k: string]: unknown }>('rooms')
      .insertOne({
        _id: 'OLDD-0001',
        version: 1,
        host: 'u_old',
        players: { blue: 'u_old', red: 'u_old2' },
        rosters: { blue: null, red: null },
        mapId: 'm',
        table: new Binary(table),
        tableRev: 0,
        createdAt: t1,
        updatedAt: t1,
        expiresAt: new Date('2099-01-01'),
      })
    expect(await store.rooms.get('OLDD-0001')).toBeNull()
    expect(await store.rooms.join('OLDD-0001', 'guest', 'u_x', { code: 'x' }, t2)).toBe(false)
    expect(await store.rooms.listForUser('u_old', 10)).toEqual([])
    expect(await store.rooms.listForUser('u_old2', 10)).toEqual([])
    await store.rooms.create(room('u_old'), t2)
    expect(
      await client
        .db(dbName)
        .collection<{ _id: string; [k: string]: unknown }>('rooms')
        .findOne({ _id: 'OLDD-0001' }),
    ).toBeNull()
    await client.close()
  })

  it('join on a taken seat writes nothing', async () => {
    const made = await store.rooms.create(room('u_j1'), t1)
    expect(await store.rooms.join(made._id, 'guest', 'u_j2', { code: 'one' }, t2)).toBe(true)
    expect(await store.rooms.join(made._id, 'guest', 'u_j3', { code: 'two' }, t2)).toBe(false)
    expect(await store.rooms.join(made._id, 'host', 'u_j3', { code: 'two' }, t2)).toBe(false)
    const got = await store.rooms.get(made._id)
    expect(got?.players).toEqual({ host: 'u_j1', guest: 'u_j2' })
    expect(got?.rosters.guest).toEqual({ code: 'one' })
    expect(got?.updatedAt).toEqual(t2)
    expect(got?.expiresAt).toEqual(new Date('2027-02-01T00:00:00Z'))
  })

  it('replaceTable writes only for the expected rev', async () => {
    const made = await store.rooms.create(room('u_r1'), t1)
    const next = new Uint8Array([9, 9])
    expect(await store.rooms.replaceTable(made._id, 1, next, t2)).toBe(false)
    expect(await store.rooms.replaceTable(made._id, 0, next, t2)).toBe(true)
    expect(await store.rooms.replaceTable(made._id, 0, table, t2)).toBe(false)
    expect(await store.rooms.getTable(made._id)).toEqual({ table: next, tableRev: 1 })
    expect((await store.rooms.get(made._id))?.updatedAt).toEqual(t2)
  })

  it('a second room of one host fails with HostingError', async () => {
    await store.rooms.create(room('u_h1'), t1)
    await expect(store.rooms.create(room('u_h1'), t1)).rejects.toBeInstanceOf(HostingError)
  })

  it('a duplicate code tries a new one', async () => {
    const first = await store.rooms.create(room('u_c1'), t1, () => 'DUPL-0001')
    expect(first._id).toBe('DUPL-0001')
    const codes = ['DUPL-0001', 'DUPL-0001', 'DUPL-0002']
    const second = await store.rooms.create(room('u_c2'), t1, () => codes.shift() ?? 'DUPL-0009')
    expect(second._id).toBe('DUPL-0002')
  })

  it('gives up after 5 duplicate codes', async () => {
    await expect(store.rooms.create(room('u_c3'), t1, () => 'DUPL-0001')).rejects.toThrow(
      'No free room code',
    )
  })

  it('delete and deleteHostedBy', async () => {
    const a = await store.rooms.create(room('u_d1'), t1)
    await store.rooms.delete(a._id)
    expect(await store.rooms.get(a._id)).toBeNull()
    const b = await store.rooms.create(room('u_d2'), t1)
    await store.rooms.deleteHostedBy('u_d2')
    expect(await store.rooms.get(b._id)).toBeNull()
  })

  it('getMany returns the users that exist', async () => {
    const u = await store.users.upsertDiscord(
      { discordId: 'g1', username: 'g', name: 'G', avatar: null },
      t1,
    )
    const map = await store.users.getMany([u._id, 'u_missing'])
    expect([...map.keys()]).toEqual([u._id])
  })
})

describe('table writes through the app on Mongo', () => {
  it('two PUTs at the same time keep both changes', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const app = createApp({ store, config: testConfig, discord: null })
    const alice = await addUser(store, 'tw-alice')
    const bob = await addUser(store, 'tw-bob')
    const start = tableUpdate({ mapId: 'vibranium-heist' })
    const json = { 'Content-Type': 'application/json' }
    const made = await app.request('/rooms', {
      method: 'POST',
      headers: { ...alice.headers, ...json },
      body: JSON.stringify({
        mapId: 'vibranium-heist',
        roster: { code: 'abc' },
        table: Buffer.from(start).toString('base64'),
      }),
    })
    const code = ((await made.json()) as { room: PublicRoom }).room.code
    await app.request(`/rooms/${code}/join`, {
      method: 'POST',
      headers: { ...bob.headers, ...json },
      body: JSON.stringify({ roster: { code: 'xyz' } }),
    })
    const put = (who: typeof alice, key: string) =>
      app.request(`/rooms/${code}/table`, {
        method: 'PUT',
        headers: { ...who.headers, 'Content-Type': 'application/octet-stream' },
        body: Buffer.from(tableUpdate({ [key]: '1' })),
      })
    const results = await Promise.all([put(alice, 'fromAlice'), put(bob, 'fromBob')])
    // A write that loses twice answers 409. Two writers lose at most once each.
    expect(results.map((r) => r.status)).toEqual([204, 204])
    const got = await app.request(`/rooms/${code}/table`, { headers: alice.headers })
    expect(tableEntries(new Uint8Array(await got.arrayBuffer()))).toEqual({
      mapId: 'vibranium-heist',
      fromAlice: '1',
      fromBob: '1',
    })
    expect((await store.rooms.getTable(code))?.tableRev).toBe(2)
    vi.restoreAllMocks()
  })
})

describe('mongo rooms store, board copy', () => {
  const image = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0xff, 0x00, 0x80])

  it('keeps name, author and image; get and list leave the image out; getImage returns the bytes', async () => {
    const made = await store.rooms.create(
      room('u_img1', { mapId: 'custom', board: { name: 'B', author: 'A', image } }),
      t1,
    )
    expect(made).toMatchObject({ boardName: 'B', boardAuthor: 'A', hasImage: true })
    expect(made).not.toHaveProperty('image')
    const got = await store.rooms.get(made._id)
    expect(got).toMatchObject({ boardName: 'B', boardAuthor: 'A', hasImage: true })
    expect(got).not.toHaveProperty('image')
    await store.rooms.join(made._id, 'guest', 'u_img2', { code: 'x' }, t1)
    const list = await store.rooms.listForUser('u_img2', 10)
    expect(list[0]).not.toHaveProperty('image')
    expect(await store.rooms.getImage(made._id)).toEqual(image)
    await store.rooms.delete(made._id)
    expect(await store.rooms.getImage(made._id)).toBeNull()
  })

  it('a room with no board, or a board without an image, has no image', async () => {
    const plain = await store.rooms.create(room('u_img3'), t1)
    expect(plain).not.toHaveProperty('boardName')
    expect(await store.rooms.getImage(plain._id)).toBeNull()
    const noImage = await store.rooms.create(
      room('u_img4', { mapId: 'custom', board: { name: 'B', author: '' } }),
      t1,
    )
    expect(noImage).toMatchObject({ boardName: 'B', hasImage: false })
    expect(await store.rooms.getImage(noImage._id)).toBeNull()
  })
})
