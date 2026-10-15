// The WebRTC connection of a multiplayer room (plan 08, decisions 1, 6, 7, 8, 15 and 20). It imports no module
// that reads import.meta.env, so node --test can load it. Everything outside is an argument.

import { trafficOf } from './traffic.js'

export const POLL_MS = 2000
const GATHER_MS = 3000
export const OFFER_MS = 15_000
export const CONNECT_MS = 15_000
export const IDLE_MS = 15 * 60_000
// How long connectionState can stay `disconnected` before the attempt ends (plan 11, decision 2)
export const DROP_MS = 10_000
// Failed attempts in a row after a drop, before the state is failed (plan 11, decision 5)
export const RECONNECT_TRIES = 3

// The data of a hello: the build id and the table schema (docs/features/peer-to-peer.md, "Connect flow").
/**
 * @param {{ build: string, schema: number }} hello
 * @returns {string}
 */
export function helloData({ build, schema }) {
  return JSON.stringify({ build, schema })
}

// { build, schema } of a hello. A plain string is the hello of an older build: schema null, which never
// equals the own schema.
/**
 * @param {string} data
 * @returns {import("./types.js").Hello}
 */
export function readHello(data) {
  try {
    const value = JSON.parse(data)
    if (value && typeof value === 'object' && !Array.isArray(value))
      return { build: String(value.build ?? ''), schema: value.schema ?? null }
  } catch {
    // A plain string
  }
  return { build: data, schema: null }
}

// role: 'host' answers, 'guest' offers. userId: the own user id. peerId: the id of this table open.
// build, schema: the build id and the table schema for hello. signaling: createSignaling(...). createPeerConnection(iceConfig), iceConfig: { iceServers, iceTransportPolicy? }.
// timers: { setTimeout, clearTimeout }.
// onState({ state, peer, versionMismatch, schemaMismatch }): state is waiting, connecting, connected, reconnecting, failed,
// stopped or gone. peer: the `user` of the other player's latest hello, or null. onChannels({ sync, live }):
// the sync channel is open, once per open. schemaMismatch: the other player's table schema differs, so the guest
// makes no offer and the host answers none. The live channel may open a moment later (plan 09, decision 13).
// reconnecting (plan 11): the connection was open and dropped. It starts when connectionState is
// `disconnected`, and ends with `connected` again within DROP_MS, with no new onChannels. After DROP_MS, or on
// `failed`, or when the sync channel closes, the attempt ends and both roles post a new hello and poll, like
// a table open. The state stays reconnecting through the new offers and answers until connected, a bye of the
// other player (waiting), RECONNECT_TRIES attempts in a row that got an answer and did not connect (failed,
// no more hellos), 15 min with no message (stopped) or a 404 (gone). An offer with no answer does not count.
// A hello of the other player does not end it.
// onChannelsEnd(): once for each attempt that opened, when it ends: the sync channel closes, or the attempt
// ends here (drop timer, failed, a new attempt, bye, idle stop, retry, stop, gone), whichever comes first. A
// browser fires no close event when its own pc.close() runs, so the caller cannot rely on the channel close.
// Returns { retry, stop, traffic }. traffic(): a promise of trafficOf(getStats()) of the open connection, or
// null when none is open (plan 09, decision 17).
export function connectRoom({
  role,
  userId,
  peerId,
  build,
  schema,
  signaling,
  createPeerConnection,
  iceConfig,
  timers = { setTimeout, clearTimeout },
  onState,
  onChannels,
  onChannelsEnd = () => {},
}) {
  const { setTimeout: later, clearTimeout: cancel } = timers
  let state = 'waiting'
  let peer = null
  let versionMismatch = false
  let schemaMismatch = false
  let lastEmit = ''
  // done: stop() or gone, nothing runs after it
  let done = false
  // The latest hello of each remote peer id, for the identity check and for Try again
  const hellos = new Map()
  let latestHello = null
  let attempt = null
  let pollTimer = null
  let polling = false
  let idleTimer = null
  // reconnecting: a drop is not over. failures: failed attempts in a row since the drop.
  let reconnecting = false
  let failures = 0
  // The hello of a round is not stored yet: no polls, so a later hello never deletes an offer of this round
  let helloPending = false
  let helloTimer = null

  function emit() {
    // After a drop, the waiting and connecting of the attempts show as reconnecting
    const shown =
      reconnecting && (state === 'waiting' || state === 'connecting') ? 'reconnecting' : state
    const key = JSON.stringify([shown, peer, versionMismatch, schemaMismatch])
    if (key === lastEmit) return
    lastEmit = key
    onState({ state: shown, peer, versionMismatch, schemaMismatch })
  }

  function setState(next) {
    if (done) return
    state = next
    emit()
  }

  // Polls

  async function pollOnce() {
    pollTimer = null
    polling = true
    let messages = []
    try {
      messages = await signaling.poll()
    } catch (err) {
      if (err?.status === 404) return gone()
      // Other errors: keep polling
    }
    polling = false
    if (done) return
    for (const message of messages) handle(message)
    if (shouldPoll() && pollTimer === null) pollTimer = later(pollOnce, POLL_MS)
  }

  const shouldPoll = () =>
    !done &&
    !helloPending &&
    state !== 'connected' &&
    state !== 'reconnecting' &&
    state !== 'stopped'

  function startPolling() {
    if (polling || pollTimer !== null || !shouldPoll()) return
    pollOnce()
  }

  function stopPolling() {
    cancel(pollTimer)
    pollTimer = null
  }

  // No message from the other player for 15 min: stop polling
  function resetIdle() {
    cancel(idleTimer)
    idleTimer = null
    // A poll that was in flight when the channel opened can still bring a message
    if (state === 'connected' || done) return
    idleTimer = later(() => {
      idleTimer = null
      endAttempt()
      stopPolling()
      clearRound()
      setState('stopped')
    }, IDLE_MS)
  }

  function gone() {
    if (done) return
    state = 'gone'
    stopPolling()
    cancel(idleTimer)
    cancel(helloTimer)
    reconnecting = false
    endAttempt()
    emit()
    done = true
  }

  // The reconnect round is over: no hello repeat, no pending hello, no count
  function clearRound() {
    cancel(helloTimer)
    helloTimer = null
    helloPending = false
    reconnecting = false
    failures = 0
  }

  // Attempts: one RTCPeerConnection each

  function endAttempt() {
    const old = attempt
    attempt = null
    if (!old) return
    cancel(old.offerTimer)
    cancel(old.connectTimer)
    cancel(old.dropTimer)
    if (old.opened && !old.ended) {
      old.ended = true
      onChannelsEnd()
    }
    old.pc.close()
  }

  function backToWaiting() {
    endAttempt()
    // Keeps reconnecting: an offer with no answer, or an error, is not a failed attempt
    setState('waiting')
    // The 15 min count messages of the other player, so a timeout here does not restart them
    if (idleTimer === null) resetIdle()
    startPolling()
  }

  // An error in an attempt that is still the current one
  function attemptError(att, err) {
    if (att !== attempt) return
    if (err?.status === 404) return gone()
    backToWaiting()
  }

  // Waits until ICE gathering ends, at most 3 s, then the description has the candidates found so far
  function gathered(pc) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve()
    return new Promise((resolve) => {
      const finish = () => {
        cancel(timer)
        pc.removeEventListener('icegatheringstatechange', onChange)
        resolve(undefined)
      }
      const onChange = () => {
        if (pc.iceGatheringState === 'complete') finish()
      }
      const timer = later(finish, GATHER_MS)
      pc.addEventListener('icegatheringstatechange', onChange)
    })
  }

  function newAttempt(remote) {
    endAttempt()
    const pc = createPeerConnection(iceConfig)
    // Negotiated: both sides create them, so there is no ondatachannel race. sync is reliable and ordered.
    // live may lose and reorder packets: the next packet replaces a lost one (plan 09, decision 13).
    const channel = pc.createDataChannel('sync', { negotiated: true, id: 0 })
    const live = pc.createDataChannel('live', {
      negotiated: true,
      id: 1,
      ordered: false,
      maxRetransmits: 0,
    })
    const att = {
      pc,
      channel,
      live,
      peer: remote,
      opened: false,
      offerTimer: null,
      connectTimer: null,
      dropTimer: null,
    }
    attempt = att

    channel.addEventListener('open', () => {
      if (att !== attempt) return
      att.opened = true
      cancel(att.offerTimer)
      cancel(att.connectTimer)
      cancel(idleTimer)
      stopPolling()
      clearRound()
      setState('connected')
      if (att === attempt && !done) onChannels({ sync: channel, live })
    })
    channel.addEventListener('close', () => {
      if (att === attempt && att.opened) dropped()
    })
    pc.addEventListener('connectionstatechange', () => {
      if (att !== attempt) return
      const connection = pc.connectionState
      if (!att.opened) {
        if (connection === 'failed') failed()
      } else if (connection === 'disconnected') {
        if (att.dropTimer !== null) return
        att.dropTimer = later(() => {
          att.dropTimer = null
          if (att === attempt) dropped()
        }, DROP_MS)
        reconnecting = true
        setState('reconnecting')
      } else if (connection === 'connected') {
        // The channels stayed open, so nothing else happens
        if (att.dropTimer === null) return
        cancel(att.dropTimer)
        att.dropTimer = null
        reconnecting = false
        setState('connected')
      } else if (connection === 'failed') dropped()
    })
    return att
  }

  // The open connection dropped for good: a new round with a new hello (plan 11, decision 3)
  function dropped() {
    endAttempt()
    reconnecting = true
    failures = 0
    setState('waiting')
    resetIdle()
    reconnectHello()
  }

  // Posts the hello of a round, and again after POLL_MS when the server did not answer. The polls start when
  // the hello is stored.
  async function reconnectHello() {
    cancel(helloTimer)
    helloTimer = null
    helloPending = true
    stopPolling()
    try {
      await signaling.hello(helloData({ build, schema }))
    } catch (err) {
      if (done || !helloPending) return
      if (err?.status === 404) return gone()
      if (!err?.status || err.status >= 500) helloTimer = later(reconnectHello, POLL_MS)
      else {
        // Another error: like a table open, go on with the polls
        helloPending = false
        startPolling()
      }
      return
    }
    if (done || !helloPending) return
    helloPending = false
    startPolling()
  }

  // The answer came or went, and ICE did not connect. Polls go on.
  function failed() {
    endAttempt()
    if (!reconnecting) return setState('failed')
    failures++
    if (failures >= RECONNECT_TRIES) {
      clearRound()
      setState('failed')
    } else {
      setState('waiting')
      // The guest offers again to the new hello
      if (role === 'host') reconnectHello()
    }
  }

  function startConnectTimer(att) {
    att.connectTimer = later(() => {
      if (att === attempt && !att.opened) failed()
    }, CONNECT_MS)
  }

  async function makeOffer(hello) {
    const att = newAttempt(hello.from)
    att.phase = 'offered'
    try {
      const { pc } = att
      await pc.setLocalDescription(await pc.createOffer())
      await gathered(pc)
      if (att !== attempt) return
      await signaling.offer(hello.from, pc.localDescription.sdp)
      if (att !== attempt) return
      setState('connecting')
      // No answer: the host's page is gone. No new offer to this hello.
      att.offerTimer = later(() => {
        if (att === attempt && att.phase === 'offered') backToWaiting()
      }, OFFER_MS)
    } catch (err) {
      attemptError(att, err)
    }
  }

  async function makeAnswer(offer) {
    const att = newAttempt(offer.from)
    att.phase = 'answered'
    try {
      const { pc } = att
      await pc.setRemoteDescription({ type: 'offer', sdp: offer.data })
      await pc.setLocalDescription(await pc.createAnswer())
      await gathered(pc)
      if (att !== attempt) return
      await signaling.answer(offer.from, pc.localDescription.sdp)
      if (att !== attempt) return
      setState('connecting')
      startConnectTimer(att)
    } catch (err) {
      attemptError(att, err)
    }
  }

  async function takeAnswer(answer) {
    const att = attempt
    att.phase = 'answered'
    cancel(att.offerTimer)
    startConnectTimer(att)
    try {
      await att.pc.setRemoteDescription({ type: 'answer', sdp: answer.data })
    } catch (err) {
      attemptError(att, err)
    }
  }

  // Messages

  function handle(message) {
    // A second tab of the same user
    if (message.user.id === userId) return
    resetIdle()
    if (message.type === 'hello') {
      hellos.set(message.from, message)
      latestHello = message
      peer = message.user
      const theirs = readHello(message.data)
      versionMismatch = theirs.build !== build
      schemaMismatch = theirs.schema !== schema
      if (attempt && attempt.peer !== message.from) endAttempt()
      if (role === 'guest' && !schemaMismatch) makeOffer(message)
      else if (!attempt) setState('waiting')
      emit()
    } else if (message.type === 'bye') {
      const known = hellos.delete(message.from)
      if (attempt?.peer === message.from || state === 'failed' || (reconnecting && known)) {
        clearRound()
        backToWaiting()
      }
    } else if (message.type === 'offer' && role === 'host') {
      if (message.to === peerId && knownUser(message) && sameSchema(message.from))
        makeAnswer(message)
    } else if (message.type === 'answer' && role === 'guest') {
      if (
        attempt?.phase === 'offered' &&
        attempt.peer === message.from &&
        message.to === peerId &&
        knownUser(message)
      )
        takeAnswer(message)
    }
  }

  // The hello of this peer id has the own schema
  const sameSchema = (from) => readHello(hellos.get(from)?.data).schema === schema

  // An offer or an answer counts only when its user is the user of the hello with the same `from`
  const knownUser = (message) => hellos.get(message.from)?.user.id === message.user.id

  // Calls

  async function postHello() {
    try {
      await signaling.hello(helloData({ build, schema }))
    } catch (err) {
      if (err?.status === 404) gone()
    }
  }

  emit()
  resetIdle()
  postHello().then(startPolling)

  return {
    async traffic() {
      const att = attempt
      if (!att?.opened) return null
      try {
        return trafficOf(await att.pc.getStats())
      } catch {
        // The connection closed during the read
        return null
      }
    },
    // Try again: a new hello, 15 min more, and the guest offers again to the host's latest hello
    async retry() {
      if (done) return
      endAttempt()
      clearRound()
      if (state !== 'waiting') setState('waiting')
      resetIdle()
      await postHello()
      if (done) return
      startPolling()
      if (role === 'guest' && latestHello && hellos.has(latestHello.from)) makeOffer(latestHello)
    },
    // keepalive: for the page close, the request outlives the page. Resolves when bye is sent (best effort).
    /** @param {{ keepalive?: boolean }} [options] */
    stop({ keepalive } = {}) {
      if (done) return Promise.resolve()
      done = true
      stopPolling()
      cancel(idleTimer)
      cancel(helloTimer)
      endAttempt()
      return signaling.bye({ keepalive }).catch(() => {})
    },
  }
}
