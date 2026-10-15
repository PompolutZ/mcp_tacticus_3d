import test from 'node:test'
import assert from 'node:assert/strict'
import { createLiveHub, newer } from './live.js'

class FakeChannel extends EventTarget {
  readyState = 'open'
  sent = []
  send(data) {
    this.sent.push(data)
  }
  receive(data) {
    this.dispatchEvent(new MessageEvent('message', { data }))
  }
  receivePacket(packet) {
    this.receive(JSON.stringify(packet))
  }
}

// A hub with a channel attached and a list of what the subscriber got
function setup(options) {
  const hub = createLiveHub(options)
  const channel = new FakeChannel()
  hub.attach(channel)
  const got = []
  hub.subscribe((update) => got.push(update))
  return { hub, channel, got }
}

test('newer: true and stored for a higher or a first number', () => {
  const seqs = new Map()
  assert.equal(newer(seqs, 'a', 5), true)
  assert.equal(newer(seqs, 'a', 5), false)
  assert.equal(newer(seqs, 'a', 4), false)
  assert.equal(newer(seqs, 'a', 6), true)
  assert.equal(newer(seqs, 'b', 1), true)
})

test('an older packet for a key is dropped, a newer one passes', () => {
  const { channel, got } = setup()
  channel.receivePacket({ s: 5, p: { 'loose:a': [1, 2] } })
  channel.receivePacket({ s: 3, p: { 'loose:a': [9, 9] } })
  channel.receivePacket({ s: 7, p: { 'loose:a': [3, 4] } })
  assert.deepEqual(got, [{ p: { 'loose:a': [1, 2] } }, { p: { 'loose:a': [3, 4] } }])
})

test('the sequence is per key: only the newer parts are handed on', () => {
  const { channel, got } = setup()
  channel.receivePacket({ s: 5, p: { 'loose:a': [1, 2] }, c: [0, 0, 0] })
  channel.receivePacket({ s: 4, p: { 'loose:b': [5, 6], 'loose:a': [8, 8] }, c: [1, 1, 1] })
  assert.deepEqual(got, [{ p: { 'loose:a': [1, 2] }, c: [0, 0, 0] }, { p: { 'loose:b': [5, 6] } }])
})

test('an old key part with a new cursor part gives only the cursor', () => {
  const { channel, got } = setup()
  channel.receivePacket({ s: 5, p: { 'loose:a': [1, 2] } })
  channel.receivePacket({ s: 6, c: null })
  channel.receivePacket({ s: 5, p: { 'loose:a': [1, 2] }, c: [1, 2, 3] })
  assert.deepEqual(got, [{ p: { 'loose:a': [1, 2] } }, { p: {}, c: null }])
  channel.receivePacket({ s: 5, p: { 'loose:a': [1, 2] }, c: [1, 2, 3] })
  assert.equal(got.length, 2)
})

test('send rounds the numbers by the kind of the key', () => {
  const { hub, channel } = setup()
  hub.send({
    p: {
      'character:7': [1.23456, 2.34567, 3.45678, 0.123456, 0.234567, 0.345678, 0.456789],
      'die:a1b2c3d4': [1.23456, 2.34567, 3.45678, 0.123456, 0.234567, 0.345678, 0.456789],
      'tool:range': [1.23456, 2.34567, 3.45678, 0.123456, 0.234567, 0.345678],
      'token:t': [1.23456, 2.34567, 0.123456],
      'loose:a': [1.23456, 2.34567],
      'pile:a': [1.23456, 2.34567],
      'tactic:a': [1.23456, 2.34567],
      'marker:host': [1.23456, 2.34567],
    },
    c: [1.23456, 2.34567, 3.45678],
  })
  assert.deepEqual(JSON.parse(channel.sent[0]), {
    s: 1,
    p: {
      'character:7': [1.235, 2.346, 3.457, 0.1235, 0.2346, 0.3457, 0.4568],
      'die:a1b2c3d4': [1.235, 2.346, 3.457, 0.1235, 0.2346, 0.3457, 0.4568],
      'tool:range': [1.235, 2.346, 3.457, 0.1235, 0.2346, 0.3457],
      'token:t': [1.235, 2.346, 0.1235],
      'loose:a': [1.235, 2.346],
      'pile:a': [1.235, 2.346],
      'tactic:a': [1.235, 2.346],
      'marker:host': [1.235, 2.346],
    },
    c: [1.235, 2.346, 3.457],
  })
})

test('s grows by one per sent packet, a null cursor is sent', () => {
  const { hub, channel } = setup()
  hub.send({ c: [0, 0, 0] })
  hub.send({ c: null })
  assert.deepEqual(
    channel.sent.map((x) => JSON.parse(x)),
    [
      { s: 1, c: [0, 0, 0] },
      { s: 2, c: null },
    ],
  )
})

test('nothing is sent on a channel that is not open, and s does not grow', () => {
  const { hub, channel } = setup()
  channel.readyState = 'connecting'
  hub.send({ c: [0, 0, 0] })
  assert.equal(channel.sent.length, 0)
  channel.readyState = 'open'
  hub.send({ c: [0, 0, 0] })
  assert.equal(JSON.parse(channel.sent[0]).s, 1)
})

test('nothing is sent without a channel or for an empty packet', () => {
  const lone = createLiveHub()
  lone.send({ c: [0, 0, 0] })
  const { hub, channel } = setup()
  hub.send({})
  hub.send({ p: {} })
  hub.send({ p: { 'nope:x': [1, 2] } })
  assert.equal(channel.sent.length, 0)
})

test('a bad packet is ignored', () => {
  const { channel, got } = setup()
  const bad = [
    'not json',
    '[]',
    'null',
    '{}',
    JSON.stringify({ s: 'x', c: null }),
    JSON.stringify({ s: 1, p: [] }),
    JSON.stringify({ s: 1, p: { 'loose:a': 'x' } }),
    JSON.stringify({ s: 1, p: { 'loose:a': [1, 'x'] } }),
    JSON.stringify({ s: 1, p: { 'loose:a': [1, null] } }),
    JSON.stringify({ s: 1, c: [1, 2] }),
    JSON.stringify({ s: 1, c: [1, 2, 'x'] }),
    JSON.stringify({ s: 1, c: 5 }),
  ]
  for (const data of bad) channel.receive(data)
  channel.receive(new ArrayBuffer(4))
  assert.equal(got.length, 0)
  // A bad packet does not take the sequence number
  channel.receivePacket({ s: 1, c: null })
  assert.equal(got.length, 1)
})

test('a key with a wrong count or an unknown kind is dropped, the good keys stay', () => {
  const { channel, got } = setup()
  channel.receivePacket({
    s: 5,
    p: {
      'tool:a': [1, 2, 3],
      'tool:b': [1, 2, 3, 4, 5, 6, 7],
      'ghost:c': [1, 2],
      'loose:d': [1, 2],
    },
  })
  assert.deepEqual(got, [{ p: { 'loose:d': [1, 2] } }])
  // A dropped key does not take its sequence number
  channel.receivePacket({ s: 1, p: { 'tool:a': [1, 2, 3, 4, 5, 6] } })
  assert.deepEqual(got[1], { p: { 'tool:a': [1, 2, 3, 4, 5, 6] } })
})

test('a packet with only dropped keys and no cursor hands nothing on', () => {
  const { channel, got } = setup()
  channel.receivePacket({ s: 1, p: { 'tool:a': [1] } })
  assert.equal(got.length, 0)
})

test('drop: a packet goes when random * 100 is under the percent', () => {
  const values = [0.2, 0.6, 0.49]
  const { channel, got } = setup({ drop: 50, random: () => values.shift() })
  channel.receivePacket({ s: 1, c: null })
  channel.receivePacket({ s: 2, c: null })
  channel.receivePacket({ s: 3, c: null })
  assert.equal(got.length, 1)
  assert.deepEqual(got[0], { p: {}, c: null })
})

test('drop 0 drops nothing, drop 100 drops everything', () => {
  const a = setup({ drop: 0, random: () => 0 })
  a.channel.receivePacket({ s: 1, c: null })
  assert.equal(a.got.length, 1)
  const b = setup({ drop: 100, random: () => 0.999 })
  b.channel.receivePacket({ s: 1, c: null })
  assert.equal(b.got.length, 0)
})

test('delay: the packet is handed on later, and the order checks run then', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { channel, got } = setup({ delay: 100 })
  channel.receivePacket({ s: 2, c: [1, 1, 1] })
  channel.receivePacket({ s: 1, c: [0, 0, 0] })
  assert.equal(got.length, 0)
  t.mock.timers.tick(99)
  assert.equal(got.length, 0)
  t.mock.timers.tick(1)
  assert.deepEqual(got, [{ p: {}, c: [1, 1, 1] }])
})

test('detach: no handler after it, and delayed packets are cleared', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { hub, channel, got } = setup({ delay: 50 })
  channel.receivePacket({ s: 1, c: null })
  hub.detach(channel)
  t.mock.timers.tick(100)
  assert.equal(got.length, 0)
  channel.receivePacket({ s: 2, c: null })
  t.mock.timers.tick(100)
  assert.equal(got.length, 0)
  // Nothing goes to a detached channel
  hub.send({ c: null })
  assert.equal(channel.sent.length, 0)
})

test('a new attach resets the sequence numbers', () => {
  const { hub, channel, got } = setup()
  channel.receivePacket({ s: 50, c: null })
  const next = new FakeChannel()
  hub.attach(next)
  // The old channel is no longer listened to
  channel.receivePacket({ s: 99, c: null })
  next.receivePacket({ s: 1, c: null })
  assert.equal(got.length, 2)
  hub.send({ c: null })
  assert.equal(next.sent.length, 1)
  assert.equal(channel.sent.length, 0)
})

test('detach of a channel that is not attached changes nothing', () => {
  const { hub, channel, got } = setup()
  const next = new FakeChannel()
  hub.attach(next)
  hub.detach(channel)
  next.receivePacket({ s: 1, c: null })
  assert.equal(got.length, 1)
})

test('unsubscribe stops the calls', () => {
  const hub = createLiveHub()
  const channel = new FakeChannel()
  hub.attach(channel)
  let calls = 0
  const off = hub.subscribe(() => calls++)
  channel.receivePacket({ s: 1, c: null })
  off()
  channel.receivePacket({ s: 2, c: null })
  assert.equal(calls, 1)
})
