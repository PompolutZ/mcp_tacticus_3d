// The WebRTC connection of a multiplayer room (plan 08, decisions 1, 6, 7, 8, 15 and 20). It imports no module
// that reads import.meta.env, so node --test can load it. Everything outside is an argument.

export const POLL_MS = 2000
export const GATHER_MS = 3000
export const OFFER_MS = 15_000
export const CONNECT_MS = 15_000
export const IDLE_MS = 15 * 60_000

// role: 'host' answers, 'guest' offers. userId: the own user id. peerId: the id of this table open.
// build: the build id for hello. signaling: createSignaling(...). createPeerConnection({ iceServers }).
// timers: { setTimeout, clearTimeout }.
// onState({ state, peer, versionMismatch }): state is waiting, connecting, connected, failed, stopped or
// gone. peer: the `user` of the other player's latest hello, or null. onChannel(channel): the sync channel
// is open. Returns { retry, stop }.
export function connectRoom({
  role,
  userId,
  peerId,
  build,
  signaling,
  createPeerConnection,
  iceServers,
  timers = { setTimeout, clearTimeout },
  onState,
  onChannel,
}) {
  const { setTimeout: later, clearTimeout: cancel } = timers
  let state = 'waiting'
  let peer = null
  let versionMismatch = false
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

  function emit() {
    const key = JSON.stringify([state, peer, versionMismatch])
    if (key === lastEmit) return
    lastEmit = key
    onState({ state, peer, versionMismatch })
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

  const shouldPoll = () => !done && state !== 'connected' && state !== 'stopped'

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
      setState('stopped')
    }, IDLE_MS)
  }

  function gone() {
    if (done) return
    state = 'gone'
    stopPolling()
    cancel(idleTimer)
    endAttempt()
    emit()
    done = true
  }

  // Attempts: one RTCPeerConnection each

  function endAttempt() {
    const old = attempt
    attempt = null
    if (!old) return
    cancel(old.offerTimer)
    cancel(old.connectTimer)
    old.pc.close()
  }

  function backToWaiting() {
    endAttempt()
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
        resolve()
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
    const pc = createPeerConnection({ iceServers })
    // Negotiated: both sides create it, so there is no ondatachannel race
    const channel = pc.createDataChannel('sync', { negotiated: true, id: 0 })
    const att = { pc, channel, peer: remote, opened: false, offerTimer: null, connectTimer: null }
    attempt = att

    channel.addEventListener('open', () => {
      if (att !== attempt) return
      att.opened = true
      cancel(att.offerTimer)
      cancel(att.connectTimer)
      cancel(idleTimer)
      stopPolling()
      setState('connected')
      if (att === attempt && !done) onChannel(channel)
    })
    channel.addEventListener('close', () => {
      if (att === attempt && att.opened) backToWaiting()
    })
    pc.addEventListener('connectionstatechange', () => {
      if (att !== attempt || pc.connectionState !== 'failed') return
      if (att.opened) backToWaiting()
      else failed()
    })
    return att
  }

  // The answer came or went, and ICE did not connect. Polls go on.
  function failed() {
    endAttempt()
    setState('failed')
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
      versionMismatch = message.data !== build
      if (attempt && attempt.peer !== message.from) endAttempt()
      if (role === 'guest') makeOffer(message)
      else if (!attempt) setState('waiting')
      emit()
    } else if (message.type === 'bye') {
      hellos.delete(message.from)
      if (attempt?.peer === message.from || state === 'failed') backToWaiting()
    } else if (message.type === 'offer' && role === 'host') {
      if (message.to === peerId && knownUser(message)) makeAnswer(message)
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

  // An offer or an answer counts only when its user is the user of the hello with the same `from`
  const knownUser = (message) => hellos.get(message.from)?.user.id === message.user.id

  // Calls

  async function postHello() {
    try {
      await signaling.hello(build)
    } catch (err) {
      if (err?.status === 404) gone()
    }
  }

  emit()
  resetIdle()
  postHello().then(startPolling)

  return {
    // Try again: a new hello, 15 min more, and the guest offers again to the host's latest hello
    async retry() {
      if (done) return
      endAttempt()
      if (state !== 'waiting') setState('waiting')
      resetIdle()
      await postHello()
      if (done) return
      startPolling()
      if (role === 'guest' && latestHello && hellos.has(latestHello.from)) makeOffer(latestHello)
    },
    // keepalive: for the page close, the request outlives the page. Resolves when bye is sent (best effort).
    stop({ keepalive } = {}) {
      if (done) return Promise.resolve()
      done = true
      stopPolling()
      cancel(idleTimer)
      endAttempt()
      return signaling.bye({ keepalive }).catch(() => {})
    },
  }
}
