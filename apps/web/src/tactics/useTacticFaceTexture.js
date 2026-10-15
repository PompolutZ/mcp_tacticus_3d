import { useEffect, useMemo, useState } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { isFaceKey } from './faceData.js'
import { tacticFaceCanvas } from './tacticFaceTexture.js'

// The drawn face of a Team Tactic card as a texture, or null for a card that has none (isFaceKey)
// and while the face is being drawn. The canvas is shared by all cards with this key (tacticFaceTexture.js),
// the texture is the card's own and is freed with it.
function useTacticFaceTexture(key) {
  const [texture, setTexture] = useState(null)
  useEffect(() => {
    if (!isFaceKey(key)) return undefined
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

// The size of the placeholder canvas, the 2.5 x 3.5 shape
const PLACEHOLDER_WIDTH = 182
const PLACEHOLDER_HEIGHT = 255

// The art at opacity 0.2 on the card color, as the face looks before its text is drawn. backMap: the
// texture of the back image of the card, which is already loaded.
function usePlaceholder(backMap, enabled) {
  const texture = useMemo(() => {
    const image = backMap?.image
    if (!enabled || !image) return null
    const canvas = document.createElement('canvas')
    canvas.width = PLACEHOLDER_WIDTH
    canvas.height = PLACEHOLDER_HEIGHT
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#f1f5f9'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = 0.2
    const w = image.width
    const h = image.height
    // object-fit: cover
    const scale = Math.max(canvas.width / w, canvas.height / h)
    ctx.drawImage(
      image,
      (canvas.width - w * scale) / 2,
      (canvas.height - h * scale) / 2,
      w * scale,
      h * scale,
    )
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    return t
  }, [backMap, enabled])
  useEffect(() => () => texture?.dispose(), [texture])
  return texture
}

// The face of a card with drawn text: the drawn face when it is ready, else the placeholder. null for a
// card that has no drawn face (the caller shows the scan). backMap: the loaded texture of the back image.
export function useTacticFaceMap(key, backMap) {
  const drawn = useTacticFaceTexture(key)
  const placeholder = usePlaceholder(backMap, isFaceKey(key) && !drawn)
  return drawn ?? placeholder
}
