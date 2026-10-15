// The messages of a connection start (plan 08, "Names"). It imports no module that reads import.meta.env, so
// node --test can load it. The API calls are arguments:
//   post(code, { from, to, type, data }, { keepalive }), get(code, peer, after) -> messages.
// Errors from post and get keep their `status`.

export function createSignaling({ code, peerId, post, get }) {
  // The id of the last message read. The next poll sends it, so it gets only newer ones.
  let cursor = null

  const send = (to, type, data = '', options) =>
    post(code, { from: peerId, to, type, data }, options)

  return {
    hello: (data) => send('*', 'hello', data),
    offer: (to, sdp) => send(to, 'offer', sdp),
    answer: (to, sdp) => send(to, 'answer', sdp),
    bye: ({ keepalive } = {}) => send('*', 'bye', '', { keepalive }),
    // The new messages for this peer, the oldest first
    async poll() {
      const messages = await get(code, peerId, cursor)
      if (messages.length > 0) cursor = messages[messages.length - 1].id
      return messages
    },
  }
}
