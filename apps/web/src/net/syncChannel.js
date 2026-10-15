// Yjs sync over the `sync` data channel (docs/features/peer-to-peer.md, "Data channels"). The message layout is the one of
// y-websocket: a varUint type (0: sync, then a y-protocols/sync message; 1: awareness, then the bytes of
// encodeAwarenessUpdate as a varUint8Array). Awareness carries the claims ("Data channels").
// It imports no module that reads import.meta.env, so node --test can load it.

import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as syncProtocol from 'y-protocols/sync'
import {
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'

const MESSAGE_SYNC = 0
const MESSAGE_AWARENESS = 1
// Frame header: a whole message, a part with more to come, the last part
const WHOLE = 0
const PART = 1
const LAST = 2
// At most 16 KB per frame with the header, a size that works in every browser pair
export const FRAME_SIZE = 16 * 1024

// Sends a message as one frame, or as parts when it is bigger. The channel is ordered and reliable.
function sendFrames(channel, message) {
  const body = FRAME_SIZE - 1
  if (message.length <= body) {
    channel.send(withHeader(WHOLE, message))
    return
  }
  for (let at = 0; at < message.length; at += body) {
    const part = message.subarray(at, at + body)
    channel.send(withHeader(at + body < message.length ? PART : LAST, part))
  }
}

function withHeader(header, bytes) {
  const frame = new Uint8Array(bytes.length + 1)
  frame[0] = header
  frame.set(bytes, 1)
  return frame
}

// Syncs doc with the other end of channel (open). Updates that come from the channel have the channel as
// origin, so they are not sent back. awareness (y-protocols Awareness of doc) is optional: with it, the own
// state goes out when the channel opens and on each update, and the states of the other end come in. stop()
// removes those states. Returns { stop }.
/**
 * @param {import("yjs").Doc} doc
 * @param {RTCDataChannel} channel
 * @param {import("y-protocols/awareness").Awareness | null} [awareness]
 */
export function syncOverChannel(doc, channel, awareness = null) {
  channel.binaryType = 'arraybuffer'
  let parts = []
  // The client ids whose awareness state came from the channel
  const remote = new Set()

  function send(encoder) {
    sendFrames(channel, encoding.toUint8Array(encoder))
  }

  function sendStep1() {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_SYNC)
    syncProtocol.writeSyncStep1(encoder, doc)
    send(encoder)
  }

  function sendAwareness(clients) {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS)
    encoding.writeVarUint8Array(encoder, encodeAwarenessUpdate(awareness, clients))
    send(encoder)
  }

  function onOpen() {
    sendStep1()
    if (awareness) sendAwareness([awareness.clientID])
  }

  // 'update', not 'change': y-protocols renews the own state every 15 s, and the other end drops a state
  // that is silent for 30 s
  function onAwareness({ added, updated, removed }, origin) {
    if (origin === channel) {
      for (const id of added.concat(updated)) if (id !== awareness.clientID) remote.add(id)
      for (const id of removed) remote.delete(id)
      return
    }
    if (channel.readyState !== 'open') return
    sendAwareness(added.concat(updated, removed))
  }

  function onUpdate(update, origin) {
    if (origin === channel || channel.readyState !== 'open') return
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_SYNC)
    syncProtocol.writeUpdate(encoder, update)
    send(encoder)
  }

  function handle(message) {
    const decoder = decoding.createDecoder(message)
    const type = decoding.readVarUint(decoder)
    if (type === MESSAGE_AWARENESS) {
      if (awareness) applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), channel)
      return
    }
    if (type !== MESSAGE_SYNC) return
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_SYNC)
    syncProtocol.readSyncMessage(decoder, encoder, doc, channel)
    // Only the type byte: the message was an update, there is nothing to answer
    if (encoding.length(encoder) > 1) send(encoder)
  }

  function onMessage(event) {
    if (!(event.data instanceof ArrayBuffer)) return
    const frame = new Uint8Array(event.data)
    if (frame.length === 0) return
    const body = frame.subarray(1)
    if (frame[0] === WHOLE) {
      parts = []
      handle(body)
    } else if (frame[0] === PART) {
      parts.push(body)
    } else if (frame[0] === LAST) {
      parts.push(body)
      const message = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
      let at = 0
      for (const p of parts) {
        message.set(p, at)
        at += p.length
      }
      parts = []
      handle(message)
    }
  }

  doc.on('update', onUpdate)
  channel.addEventListener('message', onMessage)
  awareness?.on('update', onAwareness)
  if (channel.readyState === 'open') onOpen()
  else channel.addEventListener('open', onOpen, { once: true })

  return {
    stop() {
      doc.off('update', onUpdate)
      channel.removeEventListener('message', onMessage)
      channel.removeEventListener('open', onOpen)
      if (!awareness) return
      awareness.off('update', onAwareness)
      const ids = [...remote]
      remote.clear()
      removeAwarenessStates(awareness, ids, channel)
      // y-protocols ignores a state whose clock is not newer than the one it knows. The other end sends the
      // same clock again when the channel reopens, so forget the clocks of the removed states.
      for (const id of ids) awareness.meta.delete(id)
    },
  }
}
