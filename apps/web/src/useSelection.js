import { useEffect, useState } from 'react'
import { NO_PIECES, NO_TOOLS, presenceSelection, presenceTools } from './selection.js'

// Selected pieces and tools, see selection.js. One character, one token, the range tool, the
// movement tool, the Toward / Away tool and the Line of Sight tool can all be selected at the same time.
// presence: net/presence.js, or null
export function useSelection(presence) {
  const [selection, setSelection] = useState(NO_PIECES)
  const [selectedTools, setSelectedTools] = useState(NO_TOOLS)
  // The other player sees the selection and the selected tools (docs/features/peer-to-peer.md, "What each player controls")
  useEffect(() => {
    presence?.set({
      selection: presenceSelection(selection),
      tools: presenceTools(selectedTools),
    })
  }, [presence, selection, selectedTools])
  return { selection, setSelection, selectedTools, setSelectedTools }
}
