// Plays tokenPlace when the other player's drag of a token ends with a drop on the table
// (docs/features/sounds.md). The signal is the end of their claim on the token key (net/ownership.js): the
// rest pose goes into the document before the claim ends, so the entry is already new. Poses that the app writes
// (setup, a crisis card change, held tokens that drop, Remove) have no claim, so they play nothing.

import { useEffect } from 'react'
import { playSound } from '../sound.js'
import { isTableDrop, tokenKeyParts } from './tableDrop.js'

// table: the table document (net/doc.js). ownership: net/ownership.js.
export function useRemoteDropSounds(table, ownership) {
  useEffect(() => {
    if (!ownership) return undefined
    const find = (key) => {
      const parts = tokenKeyParts(key)
      return parts && table[parts.list].read().find((entry) => entry.id === parts.id)
    }
    // Token key → its entry when the other player's claim started
    const before = new Map()
    let known = new Set()
    const check = () => {
      const now = ownership.otherOwned()
      let drops = 0
      for (const key of known) {
        if (now.has(key) || !before.has(key)) continue
        if (isTableDrop(before.get(key), find(key))) drops++
        before.delete(key)
      }
      for (const key of now) {
        if (!known.has(key) && tokenKeyParts(key)) before.set(key, find(key))
      }
      known = new Set(now)
      if (drops > 0) playSound('tokenPlace')
    }
    check()
    return ownership.subscribe(check)
  }, [table, ownership])
}
