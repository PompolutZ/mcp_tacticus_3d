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
    expect(await store.boards.get('u1')).toEqual({
      _id: 'u1',
      board,
      updatedAt: t1,
      hasImage: false,
    })
    const next: Board = { mat: 'Other', matRotation: 0, placements: [] }
    await store.boards.put('u1', next, t2)
    expect(await store.boards.get('u1')).toEqual({
      _id: 'u1',
      board: next,
      updatedAt: t2,
      hasImage: false,
    })
    await store.boards.put('u2', board, t1)
    await store.boards.delete('u1')
    expect(await store.boards.get('u1')).toBeNull()
    expect(await store.boards.get('u2')).not.toBeNull()
  })

  it('keeps the image as binary, apart from get; a put without image drops it', async () => {
    const image = new Uint8Array([82, 73, 70, 70, 0, 255, 128, 87, 69, 66, 80])
    await store.boards.put('u4', board, t1, image)
    expect(await store.boards.get('u4')).toEqual({
      _id: 'u4',
      board,
      updatedAt: t1,
      hasImage: true,
    })
    expect(await store.boards.getImage('u4')).toEqual(image)
    const client = new MongoClient(uri)
    const raw = await client
      .db(dbName)
      .collection('customBoards')
      .findOne({ _id: 'u4' as never })
    await client.close()
    expect(raw?.image._bsontype).toBe('Binary')
    await store.boards.put('u4', board, t2)
    expect(await store.boards.getImage('u4')).toBeNull()
    expect((await store.boards.get('u4'))?.hasImage).toBe(false)
    await store.boards.put('u4', board, t2, image)
    await store.boards.delete('u4')
    expect(await store.boards.getImage('u4')).toBeNull()
  })

  it('a record saved before the images has no image', async () => {
    const client = new MongoClient(uri)
    await client
      .db(dbName)
      .collection('customBoards')
      .insertOne({ _id: 'old' as never, board, updatedAt: t1 })
    await client.close()
    expect(await store.boards.get('old')).toEqual({
      _id: 'old',
      board,
      updatedAt: t1,
      hasImage: false,
    })
    expect(await store.boards.getImage('old')).toBeNull()
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
