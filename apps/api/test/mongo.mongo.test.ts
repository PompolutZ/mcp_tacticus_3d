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
