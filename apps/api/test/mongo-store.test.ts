import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMongoStore, isAtlasUri } from '../src/stores/mongo'

afterEach(() => vi.restoreAllMocks())

describe('mongo store', () => {
  it('ping returns error when the server is not reachable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = createMongoStore({
      uri: 'mongodb://127.0.0.1:1',
      dbName: 'assist3d_test',
      serverSelectionTimeoutMS: 200,
    })
    expect(await store.ping()).toBe('error')
    await store.close()
  })
})

describe('isAtlasUri', () => {
  it('is true for an Atlas host', () => {
    expect(isAtlasUri('mongodb+srv://u:p@cluster0.ab12c.mongodb.net/')).toBe(true)
  })

  it('is true for a multi-host string', () => {
    const uri =
      'mongodb://u:p@ac-abc-shard-00-00.ab12c.mongodb.net:27017,ac-abc-shard-00-01.ab12c.mongodb.net:27017/?ssl=true'
    expect(isAtlasUri(uri)).toBe(true)
  })

  it('is true for upper case', () => {
    expect(isAtlasUri('MONGODB+SRV://u:p@Cluster0.AB12C.MongoDB.NET/')).toBe(true)
  })

  it('is false for localhost', () => {
    expect(isAtlasUri('mongodb://localhost:27017')).toBe(false)
  })
})
