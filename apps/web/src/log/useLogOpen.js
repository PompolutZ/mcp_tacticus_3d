import { useState } from 'react'
import { readLogOpen, writeLogOpen } from './open.js'

// The Log panel (see LogPanel.jsx): expanded or collapsed, kept in this browser. The toolbar chip toggles it.
export function useLogOpen() {
  const [logOpen, setLogOpenState] = useState(readLogOpen)
  function setLogOpen(open) {
    setLogOpenState(open)
    writeLogOpen(open)
  }
  return [logOpen, setLogOpen]
}
