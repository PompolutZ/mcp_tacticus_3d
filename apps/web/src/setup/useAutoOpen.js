import { useEffect, useRef } from 'react'

// An overlay that opens by itself once per `key`. key: "<setup id>:<step>" while this screen should see the
// overlay, else null. onOpen() runs the first time a key shows up; a close and a rerender do not run it again,
// a new key does. Not saved: a page reload opens it again. Used by the compare and Choose 1 overlays (App.jsx).
export function useAutoOpen(key, onOpen) {
  const openedRef = useRef(null)
  useEffect(() => {
    if (!key || openedRef.current === key) return
    openedRef.current = key
    onOpen()
    // onOpen only sets state, and changes with every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
