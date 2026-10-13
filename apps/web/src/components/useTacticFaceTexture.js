import { useEffect, useState } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { spikeFace } from '../tactics/spikeFaces.js'
import { tacticFaceCanvas } from './tacticFaceTexture.js'

// The generated face of a Team Tactic card as a texture, or null for a card that has none (not a spike
// key) and while the face is being drawn. The canvas is shared by all cards with this key, the
// texture is the card's own and is freed with it.
export function useTacticFaceTexture(key) {
  const [texture, setTexture] = useState(null)
  useEffect(() => {
    if (!spikeFace(key)) return undefined
    let cancelled = false
    let made = null
    tacticFaceCanvas(key)
      .then((canvas) => {
        if (cancelled) return
        made = new CanvasTexture(canvas)
        made.colorSpace = SRGBColorSpace
        setTexture(made)
      })
      .catch((e) => console.error(`tactic face ${key}`, e))
    return () => {
      cancelled = true
      made?.dispose()
      setTexture(null)
    }
  }, [key])
  return texture
}
