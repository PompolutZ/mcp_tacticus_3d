import { useRef } from 'react'

// What is under the pointer, for the keys. Refs, not state: only a key press reads them.
// Each handler (except the dice tray one) is called with over = true when the pointer moved onto the thing, false when it moved off.
// current(): all hovers now, read from the refs at the call.
export function useHovered() {
  // Character or token under the pointer: { kind, id } | null. Only the tool keys read it, so it is a ref.
  const hoveredRef = useRef(null)
  // Id of the unlocked terrain piece under the pointer, for the Delete key
  const hoveredTerrainRef = useRef(null)
  // Id of the table token under the pointer, for the Delete key. A ref, the same as hoveredRef.
  const hoveredLooseRef = useRef(null)
  // Id of the pile under the pointer, for the Delete key
  const hoveredPileRef = useRef(null)
  // Id of the tactic card under the pointer, for the F and Delete keys
  const hoveredTacticRef = useRef(null)
  // Id of the crisis token under the pointer that a character holds, for the Delete key
  const hoveredHeldRef = useRef(null)
  // Id of the character whose tray card is under the pointer, for the F key
  const hoveredTrayCardRef = useRef(null)
  // The side of the own dice tray under the pointer, or null, for the number keys
  const diceTrayHoveredRef = useRef(null)

  function handleTerrainHover(id, over) {
    if (over) hoveredTerrainRef.current = id
    else if (hoveredTerrainRef.current === id) hoveredTerrainRef.current = null
  }

  // over: true when the pointer moved onto the piece, false when it moved off
  function handlePieceHover(piece, over) {
    if (over) hoveredRef.current = piece
    else if (hoveredRef.current?.kind === piece.kind && hoveredRef.current.id === piece.id)
      hoveredRef.current = null
  }

  // over: the pointer moved onto (true) or off (false) a crisis token that a character holds
  function handleHeldHover(id, over) {
    if (over) hoveredHeldRef.current = id
    else if (hoveredHeldRef.current === id) hoveredHeldRef.current = null
  }

  // over: the pointer moved onto (true) or off (false) the tray card of a character
  function handleTrayCardHover(id, over) {
    if (over) hoveredTrayCardRef.current = id
    else if (hoveredTrayCardRef.current === id) hoveredTrayCardRef.current = null
  }

  // over: the pointer moved onto (true) or off (false) a table token. A token that is removed or
  // dragged unmounts, which also ends its hover (see TokenFace.jsx).
  function handleLooseHover(id, over) {
    if (over) hoveredLooseRef.current = id
    else if (hoveredLooseRef.current === id) hoveredLooseRef.current = null
  }

  function handlePileHover(id, over) {
    if (over) hoveredPileRef.current = id
    else if (hoveredPileRef.current === id) hoveredPileRef.current = null
  }

  function handleTacticHover(id, over) {
    if (over) hoveredTacticRef.current = id
    else if (hoveredTacticRef.current === id) hoveredTacticRef.current = null
  }

  // side: the own tray under the pointer, or null (dice/useDiceTrayPointer.js)
  function handleDiceTrayHover(side) {
    diceTrayHoveredRef.current = side
  }

  function current() {
    return {
      piece: hoveredRef.current,
      terrain: hoveredTerrainRef.current,
      loose: hoveredLooseRef.current,
      pile: hoveredPileRef.current,
      tactic: hoveredTacticRef.current,
      held: hoveredHeldRef.current,
      trayCard: hoveredTrayCardRef.current,
      diceTray: diceTrayHoveredRef.current,
    }
  }

  return {
    hoveredRef,
    hoveredTerrainRef,
    hoveredLooseRef,
    hoveredPileRef,
    hoveredTacticRef,
    hoveredHeldRef,
    hoveredTrayCardRef,
    diceTrayHoveredRef,
    handlePieceHover,
    handleTerrainHover,
    handleHeldHover,
    handleTrayCardHover,
    handleLooseHover,
    handlePileHover,
    handleTacticHover,
    handleDiceTrayHover,
    current,
  }
}
