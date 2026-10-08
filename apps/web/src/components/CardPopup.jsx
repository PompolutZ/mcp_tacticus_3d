import { Overlay } from './Overlay.jsx'

// Full-size popup of a crisis card face. Closes on a click outside the image. App also closes it on
// Escape, as App handles all keys. A dialog, so it renders through Overlay (portal to
// document.body): a tray's own drei <Html> controls must never be able to draw over it, see
// index.css, .scene-root. A character tray card opens the whole tray instead (TrayPopup.jsx).
export function CardPopup({ card, onClose }) {
  if (!card) return null

  return (
    <Overlay className="card-popup" onClick={onClose}>
      <div className="card-popup-content" onClick={e => e.stopPropagation()}>
        <img className="card-popup-image" src={card.src} alt={card.alt} />
      </div>
    </Overlay>
  )
}
