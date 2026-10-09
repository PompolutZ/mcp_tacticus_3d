import { test, mock, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { connectRoom, CONNECT_MS, IDLE_MS, OFFER_MS, POLL_MS } from './peer.js'
import { createSignaling } from './signaling.js'

afterEach(() => mock.timers.reset())

const settle = () => new Promise((resolve) => setImmediate(resolve))
const CODE = 'K7Q2-M9XD'

// Moves the clock in steps of one poll, and lets the promises run after each step
async function run(ms) {
  for (let left = ms; left > 0; left -= POLL_MS) {
    mock.timers.tick(Math.min(POLL_MS, left))
    await settle()
  }
}

// The signaling server in memory: ids sort by time, hello and bye replace the user's older messages
function makeServer() {
  const messages = []
  const stats = { gets: 0, byPeer: {}, posts: [] }
  let n = 0
  let failGet = null
  const client = (user) => ({
    user,
    post: async (_code, message, options) => {
      stats.posts.push({ ...message, user: user.id, options })
      if (message.type === 'hello' || message.type === 'bye') {
        for (let i = messages.length - 1; i >= 0; i--)
          if (messages[i].user.id === user.id) messages.splice(i, 1)
      }
      const id = `${String(++n).padStart(13, '0')}-abcdefgh`
      messages.push({ id, ...message, user })
      return { id }
    },
    get: async (_code, peer, after) => {
      stats.gets++
      stats.byPeer[peer] = (stats.byPeer[peer] ?? 0) + 1
      if (failGet) throw Object.assign(new Error('x'), { status: failGet })
      return messages.filter(
        (m) =>
          (m.to === peer || m.to === '*') && m.from !== peer && (after === null || m.id > after),
      )
    },
  })
  return { client, stats, failGet: (status) => (failGet = status) }
}

class FakeChannel extends EventTarget {
  readyState = 'connecting'
  open() {
    this.readyState = 'open'
    this.dispatchEvent(new Event('open'))
  }
  close() {
    this.readyState = 'closed'
    this.dispatchEvent(new Event('close'))
  }
}

class FakePc extends EventTarget {
  iceGatheringState = 'new'
  connectionState = 'new'
  closed = false
  localDescription = null
  remote = null
  created = []
  constructor(index, gather) {
    super()
    this.index = index
    this.gather = gather
  }
  createDataChannel(label, options) {
    const channel = new FakeChannel()
    this.created.push({ label, options })
    if (label === 'sync') {
      this.channelArgs = { label, options }
      this.channel = channel
    } else {
      this.liveArgs = { label, options }
      this.live = channel
    }
    return channel
  }
  async createOffer() {
    return { type: 'offer', sdp: `offer-${this.index}` }
  }
  async createAnswer() {
    return { type: 'answer', sdp: `answer-${this.index}` }
  }
  async setLocalDescription(description) {
    this.localDescription = description
    if (this.gather === 'auto') this.iceGatheringState = 'complete'
  }
  async setRemoteDescription(description) {
    this.remote = description
  }
  close() {
    this.closed = true
  }
  finishGathering() {
    this.iceGatheringState = 'complete'
    this.dispatchEvent(new Event('icegatheringstatechange'))
  }
  // Both sides connect: the channels open
  connect() {
    this.connectionState = 'connected'
    this.live.open()
    this.channel.open()
  }
  fail() {
    this.connectionState = 'failed'
    this.dispatchEvent(new Event('connectionstatechange'))
  }
}

const HOST = { id: 'u-host', name: 'Host', avatar: null, discordId: null }
const GUEST = { id: 'u-guest', name: 'Guest', avatar: null, discordId: null }

// A started player. Its peer connections are in `pcs`.
async function player(server, role, user, { build = 'b1', gather = 'auto', peerId } = {}) {
  const { post, get } = server.client(user)
  const peerIdValue = peerId ?? `${role}-${Math.random().toString(36).slice(2, 10)}`
  const signaling = createSignaling({ code: CODE, peerId: peerIdValue, post, get })
  const pcs = []
  const states = []
  const channels = []
  const conn = connectRoom({
    role,
    userId: user.id,
    peerId: peerIdValue,
    build,
    signaling,
    iceConfig: { iceServers: [] },
    createPeerConnection: () => {
      const pc = new FakePc(pcs.length, gather)
      pcs.push(pc)
      return pc
    },
    onState: (s) => states.push(s),
    onChannels: (chs) => channels.push(chs),
  })
  await settle()
  return {
    conn,
    pcs,
    states,
    channels,
    signaling,
    peerId: peerIdValue,
    get state() {
      return states.at(-1)
    },
  }
}

function setup() {
  mock.timers.reset()
  mock.timers.enable({ apis: ['setTimeout'] })
  return makeServer()
}

// A hello and a bye from a user with no connectRoom, for the cases a test builds by hand
function raw(server, user, peerId = 'rawpeer-1') {
  const { post, get } = server.client(user)
  return createSignaling({ code: CODE, peerId, post, get })
}

async function connectBoth(host, guest) {
  await run(POLL_MS * 4)
  host.pcs.at(-1).connect()
  guest.pcs.at(-1).connect()
  await settle()
}

test('the guest opens second: both connect', async () => {
  const server = setup()
  const host = await player(server, 'host', HOST)
  const guest = await player(server, 'guest', GUEST)
  await connectBoth(host, guest)
  assert.equal(host.state.state, 'connected')
  assert.equal(guest.state.state, 'connected')
  assert.equal(host.channels.length, 1)
  assert.equal(guest.channels.length, 1)
  assert.deepEqual(host.state.peer, GUEST)
  assert.deepEqual(guest.state.peer, HOST)
  // Negotiated channel, created before the offer and the answer
  assert.deepEqual(guest.pcs[0].channelArgs, {
    label: 'sync',
    options: { negotiated: true, id: 0 },
  })
  assert.deepEqual(host.pcs[0].channelArgs, { label: 'sync', options: { negotiated: true, id: 0 } })
  // Both channels in each attempt, sync first, both before the offer
  const liveOptions = { negotiated: true, id: 1, ordered: false, maxRetransmits: 0 }
  for (const player of [host, guest]) {
    assert.deepEqual(
      player.pcs[0].created.map((c) => c.label),
      ['sync', 'live'],
    )
    assert.deepEqual(player.pcs[0].liveArgs, { label: 'live', options: liveOptions })
    assert.equal(player.channels[0].sync, player.pcs[0].channel)
    assert.equal(player.channels[0].live, player.pcs[0].live)
  }
  assert.equal(host.pcs[0].remote.sdp, 'offer-0')
})

test('the host opens second: both connect', async () => {
  const server = setup()
  const guest = await player(server, 'guest', GUEST)
  await run(POLL_MS * 2)
  assert.equal(guest.pcs.length, 0)
  const host = await player(server, 'host', HOST)
  await connectBoth(host, guest)
  assert.equal(host.state.state, 'connected')
  assert.equal(guest.state.state, 'connected')
})

test('connected players stop polling', async () => {
  const server = setup()
  const host = await player(server, 'host', HOST)
  const guest = await player(server, 'guest', GUEST)
  await connectBoth(host, guest)
  const gets = server.stats.gets
  await run(POLL_MS * 5)
  assert.equal(server.stats.gets, gets)
})

test('the ICE wait ends at 3 s or when gathering completes', async () => {
  const server = setup()
  await player(server, 'host', HOST)
  const guest = await player(server, 'guest', GUEST, { gather: 'manual' })
  const offers = () => server.stats.posts.filter((p) => p.type === 'offer')
  assert.equal(offers().length, 0)
  mock.timers.tick(2999)
  await settle()
  assert.equal(offers().length, 0)
  mock.timers.tick(1)
  await settle()
  assert.equal(offers().length, 1)
  assert.equal(guest.state.state, 'connecting')
  // The other way: gathering completes before the 3 s
  const server2 = setup()
  await player(server2, 'host', HOST)
  const guest2 = await player(server2, 'guest', GUEST, { gather: 'manual' })
  guest2.pcs[0].finishGathering()
  await settle()
  assert.equal(server2.stats.posts.filter((p) => p.type === 'offer').length, 1)
})

test('a hello of the own user is ignored', async () => {
  const server = setup()
  const guest = await player(server, 'guest', GUEST)
  await raw(server, GUEST, 'othertab-1').hello('b1')
  await run(POLL_MS * 2)
  assert.equal(guest.pcs.length, 0)
  assert.equal(guest.state.peer, null)
})

test('an offer from another user than its hello is ignored', async () => {
  const server = setup()
  const host = await player(server, 'host', HOST)
  await raw(server, GUEST, 'guestpeer-1').hello('b1')
  // Another user sends an offer with the peer id of the guest's hello
  const other = server.client({ id: 'u-evil', name: 'Evil', avatar: null, discordId: null })
  await other.post(CODE, { from: 'guestpeer-1', to: host.peerId, type: 'offer', data: 'sdp' })
  await run(POLL_MS * 2)
  assert.equal(host.pcs.length, 0)
  // The same offer from the user of the hello is used
  await raw(server, GUEST, 'guestpeer-1').offer(host.peerId, 'sdp')
  await run(POLL_MS * 2)
  assert.equal(host.pcs.length, 1)
})

test('a newer hello of the host makes a new offer and closes the old connection', async () => {
  const server = setup()
  const hostSide = raw(server, HOST, 'hostpeer-1')
  await hostSide.hello('b1')
  const guest = await player(server, 'guest', GUEST)
  assert.equal(guest.pcs.length, 1)
  await hostSide.hello('b1')
  await run(POLL_MS)
  assert.equal(guest.pcs.length, 2)
  assert.equal(guest.pcs[0].closed, true)
  assert.equal(guest.pcs[1].closed, false)
  assert.equal(server.stats.posts.filter((p) => p.type === 'offer').length, 2)
})

test('no answer in 15 s: waiting, and no new offer to that hello', async () => {
  const server = setup()
  await raw(server, HOST, 'hostpeer-1').hello('b1')
  const guest = await player(server, 'guest', GUEST)
  assert.equal(guest.state.state, 'connecting')
  await run(OFFER_MS - 1)
  assert.equal(guest.state.state, 'connecting')
  await run(POLL_MS)
  assert.equal(guest.state.state, 'waiting')
  assert.equal(guest.pcs[0].closed, true)
  await run(POLL_MS * 5)
  assert.equal(guest.pcs.length, 1)
  assert.equal(server.stats.posts.filter((p) => p.type === 'offer').length, 1)
})

test('failed 15 s after the answer', async () => {
  const server = setup()
  const host = await player(server, 'host', HOST)
  await player(server, 'guest', GUEST)
  await run(POLL_MS * 2)
  assert.equal(host.state.state, 'connecting')
  await run(CONNECT_MS)
  assert.equal(host.state.state, 'failed')
  assert.equal(host.pcs[0].closed, true)
  // Polls go on
  const gets = server.stats.gets
  await run(POLL_MS * 2)
  assert.ok(server.stats.gets > gets)
})

test('connectionState failed before the connection gives failed', async () => {
  const server = setup()
  const host = await player(server, 'host', HOST)
  const guest = await player(server, 'guest', GUEST)
  await run(POLL_MS * 4)
  guest.pcs[0].fail()
  assert.equal(guest.state.state, 'failed')
  assert.equal(host.state.state, 'connecting')
})

test('a closed channel gives waiting, and polls start again', async () => {
  const server = setup()
  const host = await player(server, 'host', HOST)
  const guest = await player(server, 'guest', GUEST)
  await connectBoth(host, guest)
  host.pcs[0].channel.close()
  assert.equal(host.state.state, 'waiting')
  assert.equal(host.pcs[0].closed, true)
  const gets = server.stats.gets
  await run(POLL_MS * 2)
  assert.ok(server.stats.gets > gets)
})

test('the guest reloads: the host connects again with the same peer id', async () => {
  const server = setup()
  const host = await player(server, 'host', HOST)
  const guest = await player(server, 'guest', GUEST)
  await connectBoth(host, guest)
  await guest.conn.stop()
  host.pcs[0].channel.close()
  const guest2 = await player(server, 'guest', GUEST)
  await run(POLL_MS * 4)
  host.pcs.at(-1).connect()
  guest2.pcs.at(-1).connect()
  await settle()
  assert.equal(host.pcs.length, 2)
  assert.equal(host.state.state, 'connected')
  assert.equal(guest2.state.state, 'connected')
  // onChannels: once per open, with the channels of the new attempt
  assert.equal(host.channels.length, 2)
  assert.equal(host.channels[1].sync, host.pcs[1].channel)
  assert.equal(host.channels[1].live, host.pcs[1].live)
})

test('15 min without a message from the other player: stopped, no polls', async () => {
  const server = setup()
  const guest = await player(server, 'guest', GUEST)
  await run(IDLE_MS - POLL_MS)
  assert.equal(guest.state.state, 'waiting')
  await run(POLL_MS)
  assert.equal(guest.state.state, 'stopped')
  const gets = server.stats.gets
  await run(POLL_MS * 5)
  assert.equal(server.stats.gets, gets)
})

test('a message of the other player starts the 15 min again', async () => {
  const server = setup()
  const guest = await player(server, 'guest', GUEST)
  await run(IDLE_MS / 2)
  await raw(server, HOST, 'hostpeer-1').hello('b1')
  await run(IDLE_MS / 2 + 20_000)
  assert.notEqual(guest.state.state, 'stopped')
})

test('Try again: a new hello, and the guest offers again', async () => {
  const server = setup()
  await raw(server, HOST, 'hostpeer-1').hello('b1')
  const guest = await player(server, 'guest', GUEST)
  await run(IDLE_MS)
  assert.equal(guest.state.state, 'stopped')
  const hellos = () =>
    server.stats.posts.filter((p) => p.type === 'hello' && p.user === GUEST.id).length
  const before = hellos()
  await guest.conn.retry()
  await settle()
  assert.equal(hellos(), before + 1)
  assert.equal(guest.pcs.length, 2)
  assert.equal(guest.state.state, 'connecting')
  // Polls run again
  const gets = server.stats.gets
  await run(POLL_MS * 2)
  assert.ok(server.stats.gets > gets)
})

test('Try again on the host: a new hello and polls', async () => {
  const server = setup()
  const host = await player(server, 'host', HOST)
  await run(IDLE_MS)
  assert.equal(host.state.state, 'stopped')
  await host.conn.retry()
  assert.equal(host.state.state, 'waiting')
  const gets = server.stats.gets
  await run(POLL_MS * 2)
  assert.ok(server.stats.gets > gets)
})

test('a poll 404 gives gone and ends everything', async () => {
  const server = setup()
  const guest = await player(server, 'guest', GUEST)
  server.failGet(404)
  await run(POLL_MS)
  assert.equal(guest.state.state, 'gone')
  const gets = server.stats.gets
  await run(POLL_MS * 5)
  assert.equal(server.stats.gets, gets)
  await guest.conn.stop()
  assert.equal(server.stats.posts.filter((p) => p.type === 'bye').length, 0)
})

test('another poll error keeps polling', async () => {
  const server = setup()
  const guest = await player(server, 'guest', GUEST)
  server.failGet(500)
  await run(POLL_MS * 2)
  const gets = server.stats.gets
  server.failGet(null)
  await run(POLL_MS * 2)
  assert.ok(server.stats.gets > gets)
  assert.equal(guest.state.state, 'waiting')
})

test('another build id gives versionMismatch', async () => {
  const server = setup()
  const guest = await player(server, 'guest', GUEST, { build: 'b1' })
  assert.equal(guest.state.versionMismatch, false)
  await raw(server, HOST, 'hostpeer-1').hello('b1')
  await run(POLL_MS)
  assert.equal(guest.state.versionMismatch, false)
  await raw(server, HOST, 'hostpeer-1').hello('b2')
  await run(POLL_MS)
  assert.equal(guest.state.versionMismatch, true)
  assert.equal(guest.state.peer.id, HOST.id)
})

test('stop posts bye, ends the polls and closes the connection', async () => {
  const server = setup()
  const host = await player(server, 'host', HOST)
  const guest = await player(server, 'guest', GUEST)
  await run(POLL_MS * 2)
  await guest.conn.stop({ keepalive: true })
  const bye = server.stats.posts.find((p) => p.type === 'bye')
  assert.equal(bye.user, GUEST.id)
  assert.equal(bye.options.keepalive, true)
  assert.equal(guest.pcs[0].closed, true)
  const gets = server.stats.byPeer[guest.peerId]
  const states = guest.states.length
  await run(POLL_MS * 5)
  assert.equal(server.stats.byPeer[guest.peerId], gets)
  assert.equal(guest.states.length, states)
  host.conn.stop()
})

test('a bye of the other player gives waiting', async () => {
  const server = setup()
  const hostSide = raw(server, HOST, 'hostpeer-1')
  await hostSide.hello('b1')
  const guest = await player(server, 'guest', GUEST)
  assert.equal(guest.state.state, 'connecting')
  await hostSide.bye()
  await run(POLL_MS)
  assert.equal(guest.state.state, 'waiting')
  assert.equal(guest.pcs[0].closed, true)
  // The host's old hello is not offered to again
  await run(POLL_MS * 5)
  assert.equal(guest.pcs.length, 1)
})
