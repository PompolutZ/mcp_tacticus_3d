import { randomUUID } from 'node:crypto'
import { MongoClient } from 'mongodb'
import { afterAll, describe, expect, inject, it } from 'vitest'
import { createMongoStore } from '../src/stores/mongo'

const uri = inject('mongoUri')
const dbName = `assist3d_test_${randomUUID().slice(0, 8)}`
const store = createMongoStore({ uri, dbName })

afterAll(async () => {
  await store.close()
  const client = new MongoClient(uri)
  await client.db(dbName).dropDatabase()
  await client.close()
})

const profile = { discordId: '80351110224678912', username: 'nelly', name: 'Nelly', avatar: 'h' }

describe('mongo users store', () => {
  it('upsertDiscord twice keeps one user with the same id and the new name', async () => {
    const t1 = new Date('2026-01-01T00:00:00Z')
    const t2 = new Date('2026-02-01T00:00:00Z')
    const a = await store.users.upsertDiscord(profile, t1)
    const b = await store.users.upsertDiscord({ ...profile, name: 'Nel', avatar: null }, t2)
    expect(a._id).toMatch(/^u_[\w-]{16}$/)
    expect(b._id).toBe(a._id)
    expect(b).toMatchObject({ name: 'Nel', avatar: null, createdAt: t1, lastLoginAt: t2 })
    expect(b.expiresAt).toEqual(new Date('2027-02-01T00:00:00Z'))
    const client = new MongoClient(uri)
    expect(await client.db(dbName).collection('users').countDocuments()).toBe(1)
    await client.close()
  })

  it('get, touch and delete', async () => {
    const u = await store.users.upsertDiscord({ ...profile, discordId: '2' }, new Date())
    expect((await store.users.get(u._id))?.discordId).toBe('2')
    const t = new Date('2030-01-01T00:00:00Z')
    await store.users.touch(u._id, t)
    expect((await store.users.get(u._id))?.expiresAt).toEqual(new Date('2031-01-01T00:00:00Z'))
    await store.users.delete(u._id)
    expect(await store.users.get(u._id)).toBeNull()
  })

  it('has the unique discordId index and the TTL index', async () => {
    await store.users.get('x')
    const client = new MongoClient(uri)
    const indexes = await client.db(dbName).collection('users').indexes()
    await client.close()
    expect(indexes.find((i) => i.key.discordId === 1)?.unique).toBe(true)
    expect(indexes.find((i) => i.key.expiresAt === 1)?.expireAfterSeconds).toBe(0)
  })
})
