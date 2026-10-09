import { describe, expect, it } from 'vitest'
import { configFromEnv, configFromSsm, loadSsmParams, requireParam } from '../src/config'

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
      new Error('Missing SSM parameter /mcptacticus/prod/mongodb-uri'),
    )
  })
})

describe('configFromEnv', () => {
  it('uses the fallback secret and no Discord without values', () => {
    expect(configFromEnv({}, 'fallback')).toEqual({
      version: 'dev',
      sessionSecret: 'fallback',
      discord: null,
    })
  })

  it('reads the secret and the Discord values', () => {
    const config = configFromEnv(
      {
        APP_VERSION: '1',
        SESSION_SECRET: 's',
        DISCORD_CLIENT_ID: 'id',
        DISCORD_CLIENT_SECRET: 'sec',
      },
      'fallback',
    )
    expect(config).toEqual({
      version: '1',
      sessionSecret: 's',
      discord: { clientId: 'id', clientSecret: 'sec' },
    })
  })

  it('turns Discord off when one value is missing', () => {
    expect(configFromEnv({ DISCORD_CLIENT_ID: 'id' }, 'f').discord).toBeNull()
  })
})

describe('configFromSsm', () => {
  const all = { 'session-secret': 's', 'discord-client-id': 'id', 'discord-client-secret': 'sec' }

  it('reads all values', () => {
    expect(configFromSsm(all, { APP_VERSION: '2' }, prefix)).toEqual({
      version: '2',
      sessionSecret: 's',
      discord: { clientId: 'id', clientSecret: 'sec' },
    })
  })

  it.each(['session-secret', 'discord-client-id', 'discord-client-secret'])(
    'names the missing %s',
    (name) => {
      const params: Record<string, string> = { ...all }
      delete params[name]
      expect(() => configFromSsm(params, {}, prefix)).toThrow(
        new Error(`Missing SSM parameter ${prefix}${name}`),
      )
    },
  )
})
