import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createReporter, stripQueries } from './reporter.js'

function setup(options = {}) {
  const sent = []
  const report = createReporter({
    send: (body) => {
      sent.push(body)
    },
    version: 'v1',
    agent: 'UA',
    ...options,
  })
  return { sent, report }
}

test('the first error is sent, with version, agent, room and side', () => {
  const { sent, report } = setup({ getContext: () => ({ room: 'ABC', side: 'host' }) })
  report('window', new Error('boom'))
  assert.equal(sent.length, 1)
  assert.equal(sent[0].message, 'boom')
  assert.equal(sent[0].version, 'v1')
  assert.equal(sent[0].agent, 'UA')
  assert.equal(sent[0].room, 'ABC')
  assert.equal(sent[0].side, 'host')
})

test('no room and side when there is no context', () => {
  const { sent, report } = setup({ getContext: () => ({}) })
  report('window', 'text error')
  assert.deepEqual(Object.keys(sent[0]).sort(), ['agent', 'message', 'stack', 'version'])
})

test('the same message is sent once', () => {
  const { sent, report } = setup()
  report('window', new Error('same'))
  report('scene', new Error('same'))
  report('window', new Error('other'))
  assert.equal(sent.length, 2)
})

test('at most 5 per page load', () => {
  const { sent, report } = setup()
  for (let i = 0; i < 20; i++) report('window', new Error(`e${i}`))
  assert.equal(sent.length, 5)
  assert.equal(sent[0].message, 'e0')
})

test('query strings are cut from the stack and the message', () => {
  const { sent, report } = setup()
  const error = new Error('fail at https://x.app/room?code=SECRET#h')
  error.stack =
    'Error: x\n    at a (https://x.app/assets/a.js?token=abc:1:2)\n    at b (https://x.app/b.js:3:4)'
  report('window', error)
  assert.equal(sent[0].message, 'fail at https://x.app/room')
  assert.ok(!sent[0].stack.includes('token'))
  assert.ok(sent[0].stack.includes('https://x.app/assets/a.js:1:2'))
})

test('stripQueries keeps text with no query', () => {
  assert.equal(stripQueries('at https://a.b/c.js:1:2'), 'at https://a.b/c.js:1:2')
})

test('long fields are cut to the server limits', () => {
  const { sent, report } = setup()
  const error = new Error('m'.repeat(900))
  error.stack = 's'.repeat(9000)
  report('window', error)
  assert.equal(sent[0].message.length, 500)
  assert.equal(sent[0].stack.length, 8000)
})

test('a failed send, sync or async, is ignored', async () => {
  const sync = createReporter({
    send: () => {
      throw new Error('x')
    },
  })
  sync('window', new Error('a'))
  const asyncFail = createReporter({ send: () => Promise.reject(new Error('net')) })
  asyncFail('window', new Error('b'))
  await new Promise((r) => setTimeout(r, 0))
})
