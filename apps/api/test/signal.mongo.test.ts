import { randomUUID } from 'node:crypto'
import { MongoClient } from 'mongodb'
import { afterAll, describe, expect, inject, it } from 'vitest'
import { createMongoStore } from '../src/stores/mongo'
import type { MessageDoc } from '../src/stores/store'

const uri = inject('mongoUri')
const dbName = `assist3d_test_${randomUUID().slice(0, 8)}`
const store = createMongoStore({ uri, dbName })

afterAll(async () => {
  await store.close()
  const client = new MongoClient(uri)
  await client.db(dbName).dropDatabase()
  await client.close()
})

const msg = (id: string, over: Partial<MessageDoc> = {}): MessageDoc => ({
  _id: `00000000000${id}-aaaaaaaa`,
  room: 'AAAA-AAAA',
  from: 'peer-0001',
  to: '*',
  type: 'hello',
  data: 'dev',
  user: { id: 'u_a', name: 'A', avatar: null, discordId: '1' },
  expiresAt: new Date(Date.now() + 3600_000),
  ...over,
})

describe('mongo messages store', () => {
  it('has the room index and the TTL index', async () => {
    await store.messages.count('x')
    const client = new MongoClient(uri)
    const indexes = await client.db(dbName).collection('messages').indexes()
    await client.close()
    expect(indexes.some((i) => JSON.stringify(i.key) === '{"room":1,"_id":1}')).toBe(true)
    expect(indexes.find((i) => i.key.expiresAt === 1)?.expireAfterSeconds).toBe(0)
  })

  it('adds, counts and lists to the peer or *, not from the peer, after a cursor', async () => {
    await store.messages.add(msg('10'))
    await store.messages.add(msg('11', { from: 'peer-0002', to: 'peer-0001', type: 'offer' }))
    await store.messages.add(msg('12', { from: 'peer-0002', to: 'peer-0003', type: 'offer' }))
    await store.messages.add(msg('13', { room: 'BBBB-BBBB' }))
    expect(await store.messages.count('AAAA-AAAA')).toBe(3)
    const all = await store.messages.list('AAAA-AAAA', 'peer-0001', null, 50)
    expect(all.map((m) => m.type)).toEqual(['offer'])
    const other = await store.messages.list('AAAA-AAAA', 'peer-0002', null, 50)
    expect(other.map((m) => m._id)).toEqual([msg('10')._id])
    const none = await store.messages.list('AAAA-AAAA', 'peer-0002', msg('10')._id, 50)
    expect(none).toEqual([])
    const limited = await store.messages.list('AAAA-AAAA', 'peer-0009', null, 1)
    expect(limited.map((m) => m._id)).toEqual([msg('10')._id])
  })

  it('deletes by user, by room and by user in a room', async () => {
    await store.messages.add(msg('20', { room: 'CCCC-CCCC' }))
    await store.messages.add(
      msg('21', {
        room: 'CCCC-CCCC',
        user: { id: 'u_b', name: 'B', avatar: null, discordId: '2' },
      }),
    )
    await store.messages.deleteFromUser('CCCC-CCCC', 'u_a')
    expect(await store.messages.count('CCCC-CCCC')).toBe(1)
    await store.messages.deleteRoom('CCCC-CCCC')
    expect(await store.messages.count('CCCC-CCCC')).toBe(0)
    await store.messages.deleteUser('u_a')
    expect(await store.messages.count('AAAA-AAAA')).toBe(0)
    expect(await store.messages.count('BBBB-BBBB')).toBe(0)
  })
})
