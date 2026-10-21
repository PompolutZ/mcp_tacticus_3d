import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryStore } from '../src/stores/memory'
import { addUser, makeApp } from './helpers'

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

const placement = {
  piece: 'traffic-light',
  position: [1, 0.5, -2],
  rotation: [0, 90, 0],
  scale: 1.2,
  size: 2,
  tint: [1, 0.5, 0],
}
const board = {
  id: 'my-board',
  name: 'My board',
  mat: 'Some mat',
  matRotation: 180,
  placements: [placement, { ...placement, piece: 'taxi', scale: [1, 1, 2], size: undefined }],
}

const put = (app: ReturnType<typeof makeApp>['app'], headers: object, body: unknown) =>
  app.request('/me/board', {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('/me/board', () => {
  it('needs a login', async () => {
    const { app } = makeApp()
    expect((await app.request('/me/board')).status).toBe(401)
    expect((await put(app, {}, board)).status).toBe(401)
  })

  it('GET answers 404 when there is no board', async () => {
    const { app, store } = makeApp()
    const u = await addUser(store, 'a')
    expect((await app.request('/me/board', { headers: u.headers })).status).toBe(404)
  })

  it('PUT then GET returns the board; a second PUT replaces it; users are apart', async () => {
    const { app, store } = makeApp()
    const a = await addUser(store, 'a')
    const b = await addUser(store, 'b')
    expect((await put(app, a.headers, board)).status).toBe(204)
    const res = await app.request('/me/board', { headers: a.headers })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { board: unknown }).board).toEqual(
      JSON.parse(JSON.stringify({ ...board, author: 'a' })),
    )
    const small = { mat: 'Other', matRotation: 0, placements: [] }
    expect((await put(app, a.headers, small)).status).toBe(204)
    const again = (await (await app.request('/me/board', { headers: a.headers })).json()) as {
      board: unknown
    }
    expect(again.board).toEqual({ ...small, author: 'a' })
    expect((await app.request('/me/board', { headers: b.headers })).status).toBe(404)
  })

  it('stores only the known fields', async () => {
    const { app, store } = makeApp()
    const a = await addUser(store, 'a')
    const body = { ...board, extra: 1, placements: [{ ...placement, id: 'x', y: 3 }] }
    expect((await put(app, a.headers, body)).status).toBe(204)
    const doc = await store.boards.get(a.id)
    expect(doc?.board).toEqual({ ...board, author: 'a', placements: [placement] })
  })

  it('author is the display name of the user; a body author is ignored', async () => {
    const { app, store } = makeApp()
    const a = await addUser(store, 'Alice')
    expect((await put(app, a.headers, { ...board, author: 'Mallory' })).status).toBe(204)
    expect((await store.boards.get(a.id))?.board.author).toBe('Alice')
    const res = await app.request('/me/board', { headers: a.headers })
    expect(((await res.json()) as { board: { author: string } }).board.author).toBe('Alice')
  })

  it('PUT refuses a bad shape with 400', async () => {
    const { app, store } = makeApp()
    const a = await addUser(store, 'a')
    const bad = (p: object) => ({ ...board, placements: [{ ...placement, ...p }] })
    for (const body of [
      {},
      { ...board, mat: 5 },
      { ...board, matRotation: 'x' },
      { ...board, name: 'x'.repeat(200) },
      bad({ piece: 'Bad Piece' }),
      bad({ piece: 'a'.repeat(81) }),
      bad({ position: [1, 2] }),
      bad({ rotation: [1, 2, null] }),
      bad({ scale: [1, 2] }),
      bad({ size: 6 }),
      bad({ size: 1.5 }),
      bad({ tint: [2, 0, 0] }),
    ]) {
      expect((await put(app, a.headers, body)).status).toBe(400)
    }
    expect((await put(app, a.headers, 'not json')).status).toBe(400)
    expect(await store.boards.get(a.id)).toBeNull()
  })

  it('PUT refuses more than 300 placements, accepts 300', async () => {
    const { app, store } = makeApp()
    const a = await addUser(store, 'a')
    const many = (n: number) => ({ ...board, placements: Array(n).fill(placement) })
    expect((await put(app, a.headers, many(301))).status).toBe(400)
    expect((await put(app, a.headers, many(300))).status).toBe(204)
  })

  it('PUT refuses a huge body with 413', async () => {
    const { app, store } = makeApp()
    const a = await addUser(store, 'a')
    const res = await put(app, a.headers, { ...board, name: 'x'.repeat(200 * 1024) })
    expect(res.status).toBe(413)
  })

  it('DELETE /me removes the board', async () => {
    const store = createMemoryStore()
    const { app } = makeApp(store)
    const a = await addUser(store, 'a')
    await put(app, a.headers, board)
    expect(await store.boards.get(a.id)).not.toBeNull()
    expect((await app.request('/me', { method: 'DELETE', headers: a.headers })).status).toBe(204)
    expect(await store.boards.get(a.id)).toBeNull()
  })
})
