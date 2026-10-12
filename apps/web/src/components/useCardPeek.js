import { useRef, useState } from 'react'

// The card image that shows large while Alt is held (CardPopup.jsx, peek).
export function useCardPeek() {
  // The card image under the pointer, { src, alt, by } | null, for Alt. by: who reports it, so that the
  // end of an old hover does not clear a newer one (handleCardHover).
  const hoveredCardRef = useRef(null)
  // Alt is held down
  const altHeldRef = useRef(false)
  // The card image that shows large while Alt is held, or null (CardPopup.jsx, peek)
  const [peekCard, setPeekCard] = useState(null)

  // over: the pointer moved onto (true) or off (false) a card or a model. While Alt is held, the shown card follows.
  function handleCardHover(card, over) {
    if (over) hoveredCardRef.current = card
    else if (hoveredCardRef.current?.by === card.by) hoveredCardRef.current = null
    if (altHeldRef.current) setPeekCard(hoveredCardRef.current)
  }

  // Alt pressed. blocked: a drag or a popup is open, so no peek shows
  function altDown(blocked) {
    altHeldRef.current = true
    if (!blocked) setPeekCard(hoveredCardRef.current)
  }

  // Alt released, or the window lost the focus
  function altUp() {
    altHeldRef.current = false
    setPeekCard(null)
  }

  return { peekCard, handleCardHover, altDown, altUp }
}
