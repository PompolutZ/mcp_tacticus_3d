// Yjs sync over the `sync` data channel (plan 08, decisions 9 and 10). The message layout is the one of
// y-websocket: a varUint type (0: sync), then a y-protocols/sync message. Awareness (type 1) comes in step 9.
// It imports no module that reads import.meta.env, so node --test can load it.

import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as syncProtocol from 'y-protocols/sync'

const MESSAGE_SYNC = 0
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
// origin, so they are not sent back. Returns { stop }.
export function syncOverChannel(doc, channel) {
  channel.binaryType = 'arraybuffer'
  let parts = []

  function send(encoder) {
    sendFrames(channel, encoding.toUint8Array(encoder))
  }

  function sendStep1() {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_SYNC)
    syncProtocol.writeSyncStep1(encoder, doc)
    send(encoder)
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
    if (decoding.readVarUint(decoder) !== MESSAGE_SYNC) return
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
  if (channel.readyState === 'open') sendStep1()
  else channel.addEventListener('open', sendStep1, { once: true })

  return {
    stop() {
      doc.off('update', onUpdate)
      channel.removeEventListener('message', onMessage)
      channel.removeEventListener('open', sendStep1)
    },
  }
}
