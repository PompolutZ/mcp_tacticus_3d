import { Overlay } from './Overlay.jsx'

// Full-size popup of a crisis card face. Closes on a click outside the image. App also closes it on
// Escape, as App handles all keys. A dialog, so it renders through Overlay (portal to
// document.body): a tray's own drei <Html> controls must never be able to draw over it, see
// index.css, .scene-root. A character tray card opens the whole tray instead (TrayPopup.jsx).
// peek: the image while Alt is held (useCardPeek.js). The same image in the same place, but with no backdrop
// and no pointer events, so the hover of the table under it goes on.
export function CardPopup({ card, onClose, peek = false }) {
  if (!card) return null

  return (
    <Overlay
      className={peek ? 'card-popup card-popup--peek' : 'card-popup'}
      onClick={peek ? undefined : onClose}
    >
      <div className="card-popup-content" onClick={(e) => e.stopPropagation()}>
        <img className="card-popup-image" src={card.src} alt={card.alt} />
      </div>
    </Overlay>
  )
}
