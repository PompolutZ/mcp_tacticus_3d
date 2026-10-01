import { useEffect, useState } from 'react'
import { Overlay } from './Overlay.jsx'

// Full-size popup of a card image: a crisis card face or a character tray card. Closes on a
// click outside the image. App also closes it on Escape, as App handles all keys. A dialog, so it
// renders through Overlay (portal to document.body): a tray's own drei <Html> controls must never
// be able to draw over it, see index.css, .scene-root.
// card.altSrc (character cards only): the other stat card side, shown with a button, because
// players often read the Injured side while the card is Healthy.
export function CardPopup({ card, onClose }) {
  const [showAlt, setShowAlt] = useState(false)
  // A newly opened card (or a closed one) always starts on its own side, not the last toggle.
  useEffect(() => { setShowAlt(false) }, [card])

  if (!card) return null
  const src = showAlt && card.altSrc ? card.altSrc : card.src

  return (
    <Overlay className="card-popup" onClick={onClose}>
      <div className="card-popup-content" onClick={e => e.stopPropagation()}>
        <img className="card-popup-image" src={src} alt={card.alt} />
        {card.altSrc && (
          <button type="button" className="chip card-popup-flip" onClick={() => setShowAlt(v => !v)}>
            Show other side
          </button>
        )}
      </div>
    </Overlay>
  )
}
