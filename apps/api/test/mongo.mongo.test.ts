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
