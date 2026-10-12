import { useRef, useState } from 'react'

// A short HUD message, for example an immunity block. Same pattern as the Library's own
// message (a timeout clears it), but global: a drag can end over any tray.
export function useHudMessage() {
  const [hudMessage, setHudMessage] = useState(null)
  const hudMessageTimer = useRef(null)
  // A short message in the HUD, for a few seconds (the immunity block below; the Library has its
  // own copy of this pattern for the "no 3D model" message).
  function showHudMessage(text, ms = 3000) {
    clearTimeout(hudMessageTimer.current)
    setHudMessage(text)
    hudMessageTimer.current = setTimeout(() => setHudMessage(null), ms)
  }
  return { hudMessage, showHudMessage }
}
