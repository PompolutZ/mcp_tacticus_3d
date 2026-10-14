// Sends errors to the API (POST /errors, docs/features/backend.md "Error reports"). Players do not copy
// their console, so the app does it. Few and small: at most 5 per page load, the same message once, no
// query strings. The first error is always sent. A failed send is ignored and never reported again.
import { subscribeErrors } from './errors.js'

export const MAX_PER_PAGE = 5
// The server refuses more than these
const MAX = { message: 500, stack: 8000, version: 64, agent: 300 }

// Cuts a query string (and a hash) from every URL in the text: tokens and room codes can be in them
export function stripQueries(text) {
  return text.replace(/(https?:\/\/[^\s)?#]*)[?#][^\s)]*?((?::\d+){0,2})(?=[\s)]|$)/g, '$1$2')
}

function describe(error) {
  if (error instanceof Error) {
    return { message: error.message || error.name, stack: error.stack ?? '' }
  }
  if (error && typeof error === 'object' && typeof error.message === 'string') {
    return { message: error.message, stack: typeof error.stack === 'string' ? error.stack : '' }
  }
  return { message: String(error), stack: '' }
}

// The seat this page plays in, set by the table: { room, side } or {}. The code of a single player room
// stays local.
let context = {}
export function setReportContext(next) {
  context = next ?? {}
}

// send(report): returns a promise, or nothing. deps are for the test.
export function createReporter({
  send,
  version = 'dev',
  agent = '',
  getContext = () => context,
  max = MAX_PER_PAGE,
} = {}) {
  const seen = new Set()
  let sent = 0
  return function report(_source, error) {
    if (sent >= max) return
    const { message, stack } = describe(error)
    const clean = stripQueries(message).slice(0, MAX.message)
    if (seen.has(clean)) return
    seen.add(clean)
    sent += 1
    const { room, side } = getContext()
    const body = {
      message: clean,
      stack: stripQueries(stack).slice(0, MAX.stack),
      version: String(version).slice(0, MAX.version),
      agent: String(agent).slice(0, MAX.agent),
    }
    if (room) body.room = String(room).slice(0, 16)
    if (side) body.side = side
    try {
      // Never throws and never reports: a failure here must not start a loop
      Promise.resolve(send(body)).catch(() => {})
    } catch {
      // Ignored
    }
  }
}

// Subscribes the reporter to the error hub. Once per page.
let started = false
export function startErrorReporter() {
  if (started) return
  started = true
  const report = createReporter({
    // Loaded here: the client reads import.meta.env, which the node tests do not have
    send: async (body) => {
      const { api } = await import('../api/client.js')
      await api('/errors', { method: 'POST', json: body, keepalive: true })
    },
    version: import.meta.env.VITE_BUILD_ID,
    agent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
  })
  subscribeErrors(report)
}
