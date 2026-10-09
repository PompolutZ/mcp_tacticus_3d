// Debug flags in the URL (docs/feature-peer-to-peer.md, "Debug flags"). They work in dev builds only.

// The build id of ?build=<text>, or null. It replaces the build id in hello, to try the version warning
// with one browser pair.
export function buildOverride() {
  if (!import.meta.env.DEV) return null
  return new URLSearchParams(window.location.search).get('build') || null
}

// True with ?relay: all data goes through the TURN server (iceTransportPolicy 'relay').
export function relayFlag() {
  if (!import.meta.env.DEV) return false
  return new URLSearchParams(window.location.search).has('relay')
}

// The percent of ?drop=<percent>, 0 to 100, else 0. The receiving browser drops that share of the live packets.
export function dropFlag() {
  if (!import.meta.env.DEV) return 0
  const value = Number(new URLSearchParams(window.location.search).get('drop'))
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
}

// The ms of ?delay=<ms>, at least 0, else 0. The receiving browser hands on each live packet that much later.
export function delayFlag() {
  if (!import.meta.env.DEV) return 0
  const value = Number(new URLSearchParams(window.location.search).get('delay'))
  return Number.isFinite(value) ? Math.max(0, value) : 0
}
