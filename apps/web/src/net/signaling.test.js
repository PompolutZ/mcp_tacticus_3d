import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSignaling } from './signaling.js'

function setup(batches = []) {
  const posts = []
  const gets = []
  const signaling = createSignaling({
    code: 'K7Q2-M9XD',
    peerId: 'peer-aaaa',
    post: async (code, message, options) => {
      posts.push({ code, message, options })
      return { id: '1' }
    },
    get: async (code, peer, after) => {
      gets.push({ code, peer, after })
      return batches.shift() ?? []
    },
  })
  return { signaling, posts, gets }
}

test('the cursor goes to the next poll', async () => {
  const { signaling, gets } = setup([[{ id: 'a' }, { id: 'b' }], [], [{ id: 'c' }]])
  assert.equal((await signaling.poll()).length, 2)
  await signaling.poll()
  await signaling.poll()
  await signaling.poll()
  assert.deepEqual(
    gets.map((g) => g.after),
    [null, 'b', 'b', 'c'],
  )
  assert.equal(gets[0].peer, 'peer-aaaa')
  assert.equal(gets[0].code, 'K7Q2-M9XD')
})

test('hello, offer, answer and bye have the right to and data', async () => {
  const { signaling, posts } = setup()
  await signaling.hello('abc')
  await signaling.offer('peer-bbbb', 'sdp1')
  await signaling.answer('peer-bbbb', 'sdp2')
  await signaling.bye()
  assert.deepEqual(
    posts.map((p) => p.message),
    [
      { from: 'peer-aaaa', to: '*', type: 'hello', data: 'abc' },
      { from: 'peer-aaaa', to: 'peer-bbbb', type: 'offer', data: 'sdp1' },
      { from: 'peer-aaaa', to: 'peer-bbbb', type: 'answer', data: 'sdp2' },
      { from: 'peer-aaaa', to: '*', type: 'bye', data: '' },
    ],
  )
})

test('bye passes keepalive', async () => {
  const { signaling, posts } = setup()
  await signaling.bye({ keepalive: true })
  assert.equal(posts[0].options.keepalive, true)
})

test('a poll error keeps its status and the cursor', async () => {
  let n = 0
  const signaling = createSignaling({
    code: 'K7Q2-M9XD',
    peerId: 'peer-aaaa',
    post: async () => ({}),
    get: async () => {
      if (n++ === 1) throw Object.assign(new Error('x'), { status: 404 })
      return [{ id: 'a' }]
    },
  })
  await signaling.poll()
  await assert.rejects(signaling.poll(), (err) => err.status === 404)
})
