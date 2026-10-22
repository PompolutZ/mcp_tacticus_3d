import { randomUUID } from 'node:crypto'
import { MongoClient } from 'mongodb'
import { afterAll, describe, expect, inject, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { createMongoStore } from '../src/stores/mongo'
import { testConfig } from './helpers'

const uri = inject('mongoUri')
// Own database per file, so files can share one container.
const dbName = `assist3d_test_${randomUUID().slice(0, 8)}`
const store = createMongoStore({ uri, dbName })

afterAll(async () => {
  await store.close()
  const client = new MongoClient(uri)
  await client.db(dbName).dropDatabase()
  await client.close()
})

describe('mongo store with a real server', () => {
  it('ping returns ok', async () => {
    expect(await store.ping()).toBe('ok')
  })

  it('GET /health returns db ok', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const res = await createApp({ store, config: testConfig, discord: null }).request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, version: 'test', db: 'ok' })
  })
})

describe('errors collection', () => {
  it('is capped, and the newest report comes first', async () => {
    await store.errors.add({
      time: new Date(1),
      message: 'one',
      stack: 's',
      version: 'v',
      agent: 'a',
    })
    await store.errors.add({
      time: new Date(2),
      message: 'two',
      stack: 's',
      version: 'v',
      agent: 'a',
      side: 'guest',
    })
    expect((await store.errors.latest(5)).map((r) => r.message)).toEqual(['two', 'one'])
    const client = new MongoClient(uri)
    const info = await client.db(dbName).collection('errors').options()
    await client.close()
    expect(info).toMatchObject({ capped: true, size: 10 * 1024 * 1024 })
  })

  it('a second store on the same database starts when the collection exists', async () => {
    const other = createMongoStore({ uri, dbName })
    expect(await other.errors.latest(1)).toHaveLength(1)
    await other.close()
  })
})

describe('events and salts collections', () => {
  it('two stores get the same salt of a day, and another day gets another', async () => {
    const other = createMongoStore({ uri, dbName })
    const a = await store.salts.forDay('2026-10-22')
    expect(await other.salts.forDay('2026-10-22')).toBe(a)
    expect(await store.salts.forDay('2026-10-23')).not.toBe(a)
    await other.close()
  })

  it('stores an event and has the TTL indexes', async () => {
    const event = { time: new Date(1), name: 'app_open' as const, version: 'v', visitor: 'abcd' }
    await store.events.add(event)
    const client = new MongoClient(uri)
    const db = client.db(dbName)
    const saved = await db
      .collection('events')
      .find({}, { projection: { _id: 0 } })
      .toArray()
    const eventIndexes = await db.collection('events').indexes()
    const saltIndexes = await db.collection('salts').indexes()
    await client.close()
    expect(saved).toEqual([event])
    expect(eventIndexes.find((i) => i.key.time)?.expireAfterSeconds).toBeGreaterThan(0)
    expect(saltIndexes.find((i) => i.key.expiresAt)?.expireAfterSeconds).toBe(0)
  })
})
