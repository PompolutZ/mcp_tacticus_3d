// Sends a usage event to the API (POST /events, docs/features/analytics.md). No id and no storage on the
// device. A failed send is ignored and never goes to the error reporter.
import { quietPost } from '../api/quietPost.js'

// The server refuses a longer version (MAX_VERSION in apps/api/src/stores/store.ts)
export const MAX_VERSION = 64

// send(body): returns a promise, or nothing. version is for the test.
export function createTracker({ send, version = 'dev' } = {}) {
  return function track(name, kind) {
    const body = { name, version: String(version).slice(0, MAX_VERSION) }
    if (kind) body.kind = kind
    try {
      Promise.resolve(send(body)).catch(() => {})
    } catch {
      // Ignored
    }
  }
}

let tracker
// The tracker is made on the first call: import.meta.env is not there in the node tests
export function track(name, kind) {
  tracker ??= createTracker({
    send: quietPost('/events'),
    version: import.meta.env.VITE_BUILD_ID,
  })
  tracker(name, kind)
}
