import { describe, expect, it } from 'vitest'
import { loadSsmParams, requireParam } from '../src/config'

const prefix = '/mcptacticus/prod/'

describe('loadSsmParams', () => {
  it('follows NextToken and returns short names', async () => {
    const calls: unknown[] = []
    const pages = [
      { Parameters: [{ Name: `${prefix}mongodb-uri`, Value: 'v1' }], NextToken: 'next' },
      { Parameters: [{ Name: `${prefix}session-secret`, Value: 'v2' }] },
    ]
    const client = {
      send: async (cmd: { input: unknown }) => {
        calls.push(cmd.input)
        return pages[calls.length - 1]
      },
    }
    const params = await loadSsmParams(prefix, client as never)
    expect(params).toEqual({ 'mongodb-uri': 'v1', 'session-secret': 'v2' })
    expect(calls[0]).toMatchObject({ Path: prefix, WithDecryption: true })
    expect(calls[1]).toMatchObject({ NextToken: 'next' })
  })
})

describe('requireParam', () => {
  it('returns the value', () => {
    expect(requireParam({ a: 'x' }, 'a', prefix)).toBe('x')
  })

  it('names the missing parameter and shows no value', () => {
    const params = { other: 'topsecret' }
    expect(() => requireParam(params, 'mongodb-uri', prefix)).toThrow(
      'Missing SSM parameter /mcptacticus/prod/mongodb-uri',
    )
    try {
      requireParam(params, 'mongodb-uri', prefix)
    } catch (e) {
      expect((e as Error).message).not.toContain('topsecret')
    }
  })
})
