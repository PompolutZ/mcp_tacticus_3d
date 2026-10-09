// The live hub: packets on the `live` data channel (plan 09, decisions 13, 14 and 16). The channel is unordered
// and may lose packets, so each piece and the cursor keep the sequence number of their last pose, and an older
// pose is dropped. It imports no module that reads import.meta.env, so node --test can load it. The timers, the
// random function and the flags are arguments.
//
// Packet: { s, p?, c? }. p: piece key → numbers. c: [x, y, z], or null when the pointer left the table.

// The number layout of a piece key by its kind: how many numbers are positions (3 decimals), and the total
// count. The other numbers (rotation, yaw, bend) get 4 decimals.
const LAYOUTS = {
  character: { positions: 3, total: 7 },
  tool: { positions: 3, total: 6 },
  token: { positions: 2, total: 3 },
  loose: { positions: 2, total: 2 },
  pile: { positions: 2, total: 2 },
  tactic: { positions: 2, total: 2 },
  marker: { positions: 2, total: 2 },
}

// The sequence key of the cursor. A piece key always has a colon, so they never meet.
const CURSOR = 'cursor'

const round = (value, decimals) => {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

// The numbers of a piece key, rounded by its kind, or null for an unknown kind or a wrong count
function roundPiece(key, numbers) {
  const layout = LAYOUTS[key.slice(0, key.indexOf(':'))]
  if (!layout || !Array.isArray(numbers) || numbers.length !== layout.total) return null
  return numbers.map((v, i) => round(v, i < layout.positions ? 3 : 4))
}

// True and stores s when s is higher than the stored sequence number of key, or there is none.
// seqs: a Map, key → the last sequence number.
export function newer(seqs, key, s) {
  const last = seqs.get(key)
  if (last !== undefined && s <= last) return false
  seqs.set(key, s)
  return true
}

const isNumbers = (list) => Array.isArray(list) && list.every((v) => Number.isFinite(v))
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

// The parsed packet, or null when it is bad
function parse(data) {
  if (typeof data !== 'string') return null
  let packet
  try {
    packet = JSON.parse(data)
  } catch {
    return null
  }
  if (!isObject(packet) || !Number.isFinite(packet.s)) return null
  const { p, c } = packet
  if (p !== undefined) {
    if (!isObject(p)) return null
    for (const key of Object.keys(p)) if (key === '__proto__' || !isNumbers(p[key])) return null
  }
  if (c !== undefined && c !== null && !(isNumbers(c) && c.length === 3)) return null
  return { s: packet.s, p, c }
}

// timers: { setTimeout, clearTimeout }. random: a function like Math.random. drop: the percent of received
// packets to drop, 0 to 100. delay: ms to hand on each received packet later.
// Returns { attach, detach, send, subscribe }.
export function createLiveHub({
  timers = { setTimeout, clearTimeout },
  random = Math.random,
  drop = 0,
  delay = 0,
} = {}) {
  const subscribers = new Set()
  // The attached channel: { channel, onMessage, pending: Set of timer ids }, or null
  let current = null
  // The last received sequence number per key
  let seqs = new Map()
  // The sequence number of the last sent packet
  let sent = 0

  function deliver(packet) {
    const p = {}
    let any = false
    if (packet.p) {
      for (const key of Object.keys(packet.p)) {
        if (!newer(seqs, key, packet.s)) continue
        p[key] = packet.p[key]
        any = true
      }
    }
    const out = { p }
    if (packet.c !== undefined && newer(seqs, CURSOR, packet.s)) {
      out.c = packet.c
      any = true
    }
    if (!any) return
    for (const fn of subscribers) fn(out)
  }

  function receive(attached, data) {
    const packet = parse(data)
    if (!packet) return
    if (drop > 0 && random() * 100 < drop) return
    if (delay > 0) {
      const id = timers.setTimeout(() => {
        attached.pending.delete(id)
        deliver(packet)
      }, delay)
      attached.pending.add(id)
      return
    }
    deliver(packet)
  }

  function detach(channel) {
    if (!current || current.channel !== channel) return
    channel.removeEventListener('message', current.onMessage)
    for (const id of current.pending) timers.clearTimeout(id)
    current = null
  }

  return {
    // A new channel replaces the old one and resets the sequence numbers: a reloaded sender starts at 0 again.
    attach(channel) {
      if (current) detach(current.channel)
      seqs = new Map()
      const attached = { channel, onMessage: null, pending: new Set() }
      attached.onMessage = (event) => receive(attached, event.data)
      channel.addEventListener('message', attached.onMessage)
      current = attached
    },
    detach,
    // packet: { p?, c? }. Sets s and rounds the numbers. Sends only on an open channel.
    send(packet) {
      const channel = current?.channel
      if (!channel || channel.readyState !== 'open') return
      const out = {}
      let any = false
      if (packet.p) {
        const p = {}
        for (const key of Object.keys(packet.p)) {
          const numbers = roundPiece(key, packet.p[key])
          if (!numbers) continue
          p[key] = numbers
          any = true
        }
        if (any) out.p = p
      }
      if (packet.c !== undefined) {
        out.c = packet.c === null ? null : packet.c.map((v) => round(v, 3))
        any = true
      }
      if (!any) return
      channel.send(JSON.stringify({ s: ++sent, ...out }))
    },
    // fn({ p, c? }): the parts that are newer than the last of their key. Returns the unsubscribe.
    subscribe(fn) {
      subscribers.add(fn)
      return () => subscribers.delete(fn)
    },
  }
}
