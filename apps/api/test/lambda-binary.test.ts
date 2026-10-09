import { handle, type LambdaEvent } from '@hono/aws-lambda'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import type { PublicRoom } from '../src/stores/store'
import { createMemoryStore } from '../src/stores/memory'
import { addUser, tableEntries, tableUpdate, testConfig } from './helpers'

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

// A function URL event, payload format 2.0.
function event(method: string, path: string, headers: Record<string, string>, body?: Uint8Array) {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: path,
    rawQueryString: '',
    headers: { host: 'abc.lambda-url.eu-north-1.on.aws', ...headers },
    requestContext: {
      accountId: 'anonymous',
      apiId: 'abc',
      domainName: 'abc.lambda-url.eu-north-1.on.aws',
      domainPrefix: 'abc',
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'r',
      routeKey: '$default',
      stage: '$default',
      time: '',
      timeEpoch: 0,
    },
    body: body ? Buffer.from(body).toString('base64') : undefined,
    isBase64Encoded: body !== undefined,
  } as unknown as LambdaEvent
}

it('PUT and GET move binary bodies through the Lambda adapter', async () => {
  const store = createMemoryStore()
  const handler = handle(createApp({ store, config: testConfig, discord: null }))
  const alice = await addUser(store, 'alice')
  const start = tableUpdate({ mapId: 'vibranium-heist' })

  const create = (await handler(
    event(
      'POST',
      '/rooms',
      { ...alice.headers, 'content-type': 'application/json' },
      new TextEncoder().encode(
        JSON.stringify({
          mapId: 'vibranium-heist',
          side: 'blue',
          roster: { code: 'abc' },
          table: Buffer.from(start).toString('base64'),
        }),
      ),
    ),
  )) as { body: string }
  const code = (JSON.parse(create.body) as { room: PublicRoom }).room.code

  // Bytes above 127 would break a UTF-8 round trip.
  const change = tableUpdate({ cardA: 'moved éÿ' })
  const put = (await handler(
    event(
      'PUT',
      `/rooms/${code}/table`,
      { ...alice.headers, 'content-type': 'application/octet-stream' },
      change,
    ),
  )) as { statusCode: number }
  expect(put.statusCode).toBe(204)

  const got = (await handler(event('GET', `/rooms/${code}/table`, alice.headers))) as {
    statusCode: number
    isBase64Encoded: boolean
    body: string
    headers: Record<string, string>
  }
  expect(got.statusCode).toBe(200)
  expect(got.isBase64Encoded).toBe(true)
  expect(got.headers['content-type']).toBe('application/octet-stream')
  expect(tableEntries(new Uint8Array(Buffer.from(got.body, 'base64')))).toEqual({
    mapId: 'vibranium-heist',
    cardA: 'moved éÿ',
  })
})
