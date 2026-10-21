import { randomUUID } from 'node:crypto'
import { MongoClient } from 'mongodb'
import { afterAll, describe, expect, inject, it } from 'vitest'
import { createMongoStore } from '../src/stores/mongo'
import type { Board } from '../src/stores/store'

const uri = inject('mongoUri')
const dbName = `[REDACTED:DB_NAME]_test_${randomUUID().slice(0, 8)}`
const store = createMongoStore({ uri, dbName })

afterAll(async () => {
  await store.close()
  const client = new MongoClient(uri)
  await client.db(dbName).dropDatabase()
  await client.close()
})

const board: Board = {
  id: 'b',
  mat: 'Some mat',
  matRotation: 90,
  placements: [{ piece: 'taxi', position: [0, 1, 2], rotation: [0, 0, 0], scale: 1, size: 3 }],
}
const t1 = new Date('2026-01-01T00:00:00Z')
const t2 = new Date('2026-02-01T00:00:00Z')

describe('mongo boards store', () => {
  it('get is null, put then get, put replaces, delete', async () => {
    expect(await store.boards.get('u1')).toBeNull()
    await store.boards.put('u1', board, t1)
    expect(await store.boards.get('u1')).toEqual({ _id: 'u1', board, updatedAt: t1 })
    const next: Board = { mat: 'Other', matRotation: 0, placements: [] }
    await store.boards.put('u1', next, t2)
    expect(await store.boards.get('u1')).toEqual({ _id: 'u1', board: next, updatedAt: t2 })
    await store.boards.put('u2', board, t1)
    await store.boards.delete('u1')
    expect(await store.boards.get('u1')).toBeNull()
    expect(await store.boards.get('u2')).not.toBeNull()
  })

  it('keeps one record per user in customBoards', async () => {
    await store.boards.put('u3', board, t1)
    await store.boards.put('u3', board, t2)
    const client = new MongoClient(uri)
    const n = await client
      .db(dbName)
      .collection('customBoards')
      .countDocuments({ _id: 'u3' as never })
    await client.close()
    expect(n).toBe(1)
  })
})
