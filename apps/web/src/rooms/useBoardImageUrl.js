import { useEffect, useRef, useState } from 'react'

// The object URL of a board top view, or null: none, or not loaded yet. load: a function that returns a Promise of
// the WebP Blob (or null when there is none), or null to load nothing (no login, no image). key: when it changes, the
// image loads again (the account, a room code). The URL is revoked when the component goes or the key changes.
export function useBoardImageUrl(load, key) {
  const [url, setUrl] = useState(null)
  const loadRef = useRef(load)
  const enabled = Boolean(load)
  // Set before the effect below runs: effects run in order
  useEffect(() => {
    loadRef.current = load
  })
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let made = null
    loadRef
      .current()
      .then((blob) => {
        if (cancelled || !blob) return
        made = URL.createObjectURL(blob)
        setUrl(made)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (made) URL.revokeObjectURL(made)
      setUrl(null)
    }
  }, [enabled, key])
  return enabled ? url : null
}
