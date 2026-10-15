import { useRef, useState } from 'react'

// A short message that a timeout clears. The HUD one (App) is global: a drag can end over any tray. The
// Library uses its own instance for the "no 3D model" message.
export function useHudMessage() {
  const [hudMessage, setHudMessage] = useState(null)
  const hudMessageTimer = useRef(null)
  // A short message for a few seconds, for example the immunity block
  function showHudMessage(text, ms = 3000) {
    clearTimeout(hudMessageTimer.current)
    setHudMessage(text)
    hudMessageTimer.current = setTimeout(() => setHudMessage(null), ms)
  }
  return { hudMessage, showHudMessage }
}
