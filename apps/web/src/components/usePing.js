import { useState } from 'react'

// presence: net/presence.js, or null. toolPointRef: Scene fills it (ToolPoint.jsx).
export function usePing(presence, toolPointRef) {
  // The last ping of this browser, { id, at: [x, y, z], t } | null. Scene shows it (Ping.jsx).
  const [ownPing, setOwnPing] = useState(null)

  // Key P: a ping at the table point under the pointer, none when the pointer is off the table. It shows
  // here at once, and in the other browser through presence (docs/features/ping.md).
  function handlePingKey() {
    const point = toolPointRef.current?.atPointer()
    if (!point) return
    const next = { id: crypto.randomUUID(), at: [point.x, point.y, point.z] }
    setOwnPing(next)
    presence?.set({ ping: next })
  }

  return { ownPing, handlePingKey }
}
