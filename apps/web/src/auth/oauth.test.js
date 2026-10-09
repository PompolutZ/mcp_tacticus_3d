import assert from 'node:assert/strict'
import test from 'node:test'
import { authorizeUrl, randomState, readCallback } from './oauth.js'

const saved = { state: 'abc', returnHash: '#room=K7Q2-M9XD' }

test('authorizeUrl has the OAuth parameters', () => {
  const url = new URL(
    authorizeUrl({ clientId: '123', redirectUri: 'http://localhost:5173/', state: 'abc' }),
  )
  assert.equal(url.origin + url.pathname, 'https://discord.com/oauth2/authorize')
  const p = url.searchParams
  assert.equal(p.get('response_type'), 'code')
  assert.equal(p.get('client_id'), '123')
  assert.equal(p.get('scope'), 'identify')
  assert.equal(p.get('prompt'), 'none')
  assert.equal(p.get('redirect_uri'), 'http://localhost:5173/')
  assert.equal(p.get('state'), 'abc')
})

test('randomState differs each time', () => {
  assert.notEqual(randomState(), randomState())
})

test('readCallback: no query is no callback', () => {
  assert.equal(readCallback('', saved), null)
  assert.equal(readCallback('?foo=1', saved), null)
})

test('readCallback: a code with the saved state', () => {
  assert.deepEqual(readCallback('?code=x&state=abc', saved), {
    code: 'x',
    returnHash: '#room=K7Q2-M9XD',
  })
})

test('readCallback: a wrong state is an error', () => {
  assert.deepEqual(readCallback('?code=x&state=zzz', saved), { error: 'Login failed. Try again.' })
})

test('readCallback: no saved state is an error', () => {
  assert.deepEqual(readCallback('?code=x&state=abc', null), { error: 'Login failed. Try again.' })
})

test('readCallback: access_denied is cancelled', () => {
  assert.deepEqual(readCallback('?error=access_denied&state=abc', saved), {
    error: 'Login cancelled.',
  })
})

test('readCallback: another error is a failure', () => {
  assert.deepEqual(readCallback('?error=server_error&state=abc', saved), {
    error: 'Login failed. Try again.',
  })
})
