import { useEffect, useRef } from 'react'
import { addEntry, logEntry } from '../log/log.js'
import { hasFreshThrow, readRollOff, shelfSymbols } from './rollOff.js'
import { setRollOff, setupStep } from './setup.js'

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
    const current = table.setup.read()
    if (setupStep(current) !== 'rollOff') return
    const shelves = shelfSymbols(table.dice.read())
    if (!shelves) return
    const result = readRollOff(shelves)
    if (JSON.stringify(current.rollOff) === JSON.stringify(result)) return
    // The marker follows the winner. On a tie it stays as it is. Both browsers may write the entry, so its id
    // is fixed: the setup and the last throw.
    const lastThrow = rolls.findLast((entry) => entry.kind === 'throw')
    table.transact(() => {
      table.setup.set(setRollOff(current, result))
      if (result.winner) table.game.setField('priority', result.winner)
      const id = `rolloff:${current.id}:${lastThrow.id}`
      table.log.set((list) =>
        addEntry(list, logEntry('rollOff', mySide, { side: result.winner }, id)),
      )
    })
  }, [rolls, table, mySide])
}
