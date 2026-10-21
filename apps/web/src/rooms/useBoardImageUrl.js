import { useEffect, useState } from 'react'
import { getBoardImage } from '../api/board.js'

// The object URL of the top view of the saved board of the account, or null: none, or not loaded yet. enabled: false
// loads nothing (no login, or no image). The URL is revoked when the component goes or enabled changes.
export function useBoardImageUrl(enabled) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let made = null
    getBoardImage()
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
  }, [enabled])
  return enabled ? url : null
}
