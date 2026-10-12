// Plays the sound of a token put on a character for each new `log` entry, in both browsers
// (docs/features/sounds.md). Entries that exist when the table opens, and entries older than MAX_AGE_MS,
// play nothing.

import { useEffect, useRef } from 'react'
import { playSound } from '../sound.js'
import { soundOf } from './log.js'

const MAX_AGE_MS = 5000

// log: the entries of the `log` list, oldest first
export function useLogSounds(log) {
  // The ids that are seen. The first run takes the entries of the open table without a sound.
  const seen = useRef(null)
  useEffect(() => {
    const now = Date.now()
    const known = seen.current
    seen.current = new Set(log.map((entry) => entry.id))
    if (!known) return
    let group = null
    for (const entry of log) {
      if (known.has(entry.id) || now - entry.at > MAX_AGE_MS) continue
      const next = soundOf(entry)
      // Activated wins over a token sound in the same batch
      if (next && group !== 'activated') group = next
    }
    if (group) playSound(group)
  }, [log])
}
