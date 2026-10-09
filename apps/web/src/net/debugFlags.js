// Debug flags in the URL (docs/feature-peer-to-peer.md, "Debug flags"). They work in dev builds only.

// The build id of ?build=<text>, or null. It replaces the build id in hello, to try the version warning
// with one browser pair.
export function buildOverride() {
  if (!import.meta.env.DEV) return null
  return new URLSearchParams(window.location.search).get('build') || null
}
