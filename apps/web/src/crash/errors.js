// Error hub. Every uncaught error, unhandled rejection and scene error boundary catch goes through
// reportError. The first one is logged with "[first error]": after the first Rapier fault every later
// call fails too, so only the first one shows the trigger. subscribeErrors(fn) is the hook for a reporter
// (fn(source, error)). See docs/features/table-tools.md, "Recovery".
const listeners = new Set()
let first = true
let installed = false

// Calls fn(source, error) for each error. Returns the function that stops it.
export function subscribeErrors(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// source: 'window' | 'promise' | 'scene'
export function reportError(source, error) {
  if (first) {
    first = false
    console.error(`[first error] (${source})`, error)
  }
  for (const fn of listeners) {
    try {
      fn(source, error)
    } catch {
      // A reporter must never throw into the app
    }
  }
}

// Adds the window listeners once. Returns nothing: they live as long as the page.
export function installErrorListeners() {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('error', (e) => reportError('window', e.error ?? e.message))
  window.addEventListener('unhandledrejection', (e) => reportError('promise', e.reason))
}
