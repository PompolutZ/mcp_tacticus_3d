import { useEffect, useState } from 'react'
import { faceCard, faceTextLoaded, loadFaceText } from './faceData.js'

// The Jarvis face entry of a card (with its name), or null while the text loads or when the card has none
export function useFaceCard(key) {
  const [, setLoaded] = useState(faceTextLoaded())
  useEffect(() => {
    if (faceTextLoaded()) return undefined
    let cancelled = false
    loadFaceText().then(() => !cancelled && setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [])
  return faceCard(key)
}
