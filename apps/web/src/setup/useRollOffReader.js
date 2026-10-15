import { useEffect, useRef } from 'react'
import { readRollOffWrite } from './actions.js'
import { hasFreshThrow } from './rollOff.js'

// The roll off, read from the dice trays (see docs/features/setup-game.md, "Roll off"). The reader is
// effect E8; it runs before the reveal effect E9 in App.
export function useRollOffReader({ table, rolls, mySide }) {
  // The roll off is read when a new `throw` entry reaches the history, from this browser or the other one.
  // The shelf write and the entry are one transaction, so a browser that has the last entry has both full
  // shelves. Both browsers may write: the result is the same, and the write is skipped when it is already
  // there. Entries that were there at mount, or older than ROLL_OFF_FRESH ms (a history that syncs late),
  // are not new, so shelves left from before a restart do not count without a new throw.
  const seenThrows = useRef(null)
  useEffect(() => {
    const seen = seenThrows.current
    seenThrows.current = new Set(rolls.map((entry) => entry.id))
    if (!seen) return
    if (!hasFreshThrow(rolls, seen, Date.now())) return
    const lastThrow = rolls.findLast((entry) => entry.kind === 'throw')
    readRollOffWrite(table, { mySide, throwId: lastThrow.id })
  }, [rolls, table, mySide])
}
