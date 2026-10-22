import { useEffect, useRef, useState } from 'react'
import { fitRows, ROW_HEIGHT } from './rowFit.js'

// Row scale of one Streamer column (rowFit.js). The column is absolute, from its top down to the bottom
// reserve (--col-reserve in streamer.css). The free height for the list is that room minus what is not the
// list (header, borders, Team tactics). Returns the ref for the column and the ref for the list.
// size: the column size factor (1 = 100%), count: rows. Measures again on a resize of the window or the
// column, and when --streamer-top changes (a style change of the root).
export function useRowFit(count, size) {
  const colRef = useRef(null)
  const listRef = useRef(null)
  const [fit, setFit] = useState({ scale: 1, scroll: false })
  useEffect(() => {
    const col = colRef.current
    const list = listRef.current
    if (!col) return undefined
    const measure = () => {
      const parent = col.offsetParent
      if (!parent || !list) return
      const reserve = parseFloat(getComputedStyle(col).getPropertyValue('--col-reserve')) || 0
      const room = parent.clientHeight - col.offsetTop - reserve
      // 2px spare for rounding
      const available = room - (col.offsetHeight - list.offsetHeight) - 2
      const next = fitRows({ available, count, rowHeight: ROW_HEIGHT * size })
      setFit((old) => (old.scale === next.scale && old.scroll === next.scroll ? old : next))
    }
    measure()
    window.addEventListener('resize', measure)
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    resize?.observe(col)
    if (col.offsetParent) resize?.observe(col.offsetParent)
    const mutation = new MutationObserver(measure)
    mutation.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => {
      window.removeEventListener('resize', measure)
      resize?.disconnect()
      mutation.disconnect()
    }
  }, [count, size])
  return { colRef, listRef, fit }
}
