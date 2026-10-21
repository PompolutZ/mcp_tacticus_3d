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

// The start of a WebP file, with bytes above 127
const webp = new Uint8Array(
  [...'RIFF', 0, 0, 0, 0, ...'WEBP', 0xff, 0xd8].map((v) =>
    typeof v === 'string' ? v.charCodeAt(0) : v,
  ),
)
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

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

  it('PUT refuses an id that is not kebab-case with 400, accepts a kebab-case id', async () => {
    const { app, store } = makeApp()
    const a = await addUser(store, 'a')
    for (const id of ['My Board', '../x', 'a--b', '-a', 'a-', '', 'a'.repeat(81)]) {
      expect((await put(app, a.headers, { ...board, id })).status).toBe(400)
    }
    expect(await store.boards.get(a.id)).toBeNull()
    expect((await put(app, a.headers, { ...board, id: 'my-board-k3x9' })).status).toBe(204)
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
    const res = await put(app, a.headers, { ...board, name: 'x'.repeat(400 * 1024) })
    expect(res.status).toBe(413)
  })

  it('PUT then GET image: the bytes come back as image/webp; GET says hasImage', async () => {
    const { app, store } = makeApp()
    const a = await addUser(store, 'a')
    const b = await addUser(store, 'b')
    expect((await put(app, a.headers, { ...board, image: b64(webp) })).status).toBe(204)
    const info = (await (await app.request('/me/board', { headers: a.headers })).json()) as {
      hasImage: boolean
    }
    expect(info.hasImage).toBe(true)
    const res = await app.request('/me/board/image', { headers: a.headers })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/webp')
    expect(res.headers.get('cache-control')).toBe('private, no-cache')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(webp)
    expect((await app.request('/me/board/image', { headers: b.headers })).status).toBe(404)
    expect((await app.request('/me/board/image')).status).toBe(401)
  })

  it('a board without an image: hasImage false, image 404; a save without image drops the old one', async () => {
    const { app, store } = makeApp()
    const a = await addUser(store, 'a')
    await put(app, a.headers, board)
    const info = (await (await app.request('/me/board', { headers: a.headers })).json()) as {
      hasImage: boolean
    }
    expect(info.hasImage).toBe(false)
    expect((await app.request('/me/board/image', { headers: a.headers })).status).toBe(404)
    await put(app, a.headers, { ...board, image: b64(webp) })
    await put(app, a.headers, board)
    expect((await app.request('/me/board/image', { headers: a.headers })).status).toBe(404)
  })

  it('PUT refuses an image that is not WebP with 400, and does not save the board', async () => {
    const { app, store } = makeApp()
    const a = await addUser(store, 'a')
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    for (const image of [b64(png), b64(new Uint8Array(5)), 'not base64!', '']) {
      const res = await put(app, a.headers, { ...board, image })
      expect(res.status).toBe(400)
    }
    expect(await store.boards.get(a.id)).toBeNull()
  })

  it('PUT refuses an image over 150 KB with 413, accepts 150 KB', async () => {
    const { app, store } = makeApp()
    const a = await addUser(store, 'a')
    const sized = (n: number) => {
      const bytes = new Uint8Array(n)
      bytes.set(webp)
      return b64(bytes)
    }
    expect((await put(app, a.headers, { ...board, image: sized(150 * 1024 + 1) })).status).toBe(413)
    expect(await store.boards.get(a.id)).toBeNull()
    expect((await put(app, a.headers, { ...board, image: sized(150 * 1024) })).status).toBe(204)
  })

  it('DELETE /me removes the board and its image', async () => {
    const store = createMemoryStore()
    const { app } = makeApp(store)
    const a = await addUser(store, 'a')
    await put(app, a.headers, { ...board, image: b64(webp) })
    expect(await store.boards.getImage(a.id)).not.toBeNull()
    expect((await app.request('/me', { method: 'DELETE', headers: a.headers })).status).toBe(204)
    expect(await store.boards.get(a.id)).toBeNull()
    expect(await store.boards.getImage(a.id)).toBeNull()
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
