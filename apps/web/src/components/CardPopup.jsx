import { Overlay } from './Overlay.jsx'
import { FACE_HEIGHT, FACE_WIDTH } from './TacticFace.jsx'
import TacticFaceScaled from './TacticFaceScaled.jsx'

// The face component of a Team Tactic card at a scale that fits the window, at most POPUP_SCALE. Set when it opens.
const POPUP_SCALE = 1.4

function TacticFacePopup({ tacticKey }) {
  const scale = Math.min(
    POPUP_SCALE,
    (window.innerHeight * 0.9) / FACE_HEIGHT,
    (window.innerWidth * 0.9) / FACE_WIDTH,
  )
  return (
    <div
      className="card-popup-image tactic-face-popup"
      style={{ position: 'relative', width: FACE_WIDTH * scale, height: FACE_HEIGHT * scale }}
    >
      <TacticFaceScaled tacticKey={tacticKey} />
    </div>
  )
}

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
        {card.tacticKey ? (
          <TacticFacePopup tacticKey={card.tacticKey} />
        ) : (
          <img className="card-popup-image" src={card.src} alt={card.alt} />
        )}
      </div>
    </Overlay>
  )
}
