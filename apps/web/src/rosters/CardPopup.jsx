import { useEffect, useState } from 'react'
import { Overlay } from '../ui/Overlay.jsx'
import { useTableStore } from '../table/TableStoreContext.jsx'
import { FACE_HEIGHT, FACE_WIDTH } from '../tactics/TacticFace.jsx'
import TacticFaceScaled from '../tactics/TacticFaceScaled.jsx'
import { peekBox } from './peekSize.js'

// The face component of a Team Tactic card at a scale that fits the window, at most POPUP_SCALE. Set when it opens.
const POPUP_SCALE = 1.4

// The window size, kept up to date while on is true
function useWindowSize(on) {
  const [size, setSize] = useState({
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
  })
  useEffect(() => {
    if (!on) return undefined
    const update = () =>
      setSize({ windowWidth: window.innerWidth, windowHeight: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [on])
  return size
}

// The image of the Alt peek. Its box has the aspect ratio of the image, known after it loads.
function PeekImage({ card, size }) {
  const windowSize = useWindowSize(true)
  const [aspect, setAspect] = useState(0)
  const box = aspect > 0 ? peekBox({ ...windowSize, aspect, size }) : null
  return (
    <img
      className="card-popup-image card-popup-image--peek"
      src={card.src}
      alt={card.alt}
      style={box ? { width: box.width, height: box.height } : { visibility: 'hidden' }}
      onLoad={(e) => setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
    />
  )
}

function TacticFacePopup({ tacticKey, peekSize }) {
  const windowSize = useWindowSize(peekSize !== undefined)
  let width
  let height
  if (peekSize !== undefined) {
    // The Alt peek: the size is a part of the largest box that fits the window
    ;({ width, height } = peekBox({
      ...windowSize,
      aspect: FACE_WIDTH / FACE_HEIGHT,
      size: peekSize,
    }))
  } else {
    const scale = Math.min(
      POPUP_SCALE,
      (window.innerHeight * 0.9) / FACE_HEIGHT,
      (window.innerWidth * 0.9) / FACE_WIDTH,
    )
    width = FACE_WIDTH * scale
    height = FACE_HEIGHT * scale
  }
  return (
    <div
      className={`card-popup-image tactic-face-popup${peekSize !== undefined ? ' card-popup-image--peek' : ''}`}
      style={{ position: 'relative', width, height }}
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
// and no pointer events, so the hover of the table under it goes on. Needs no table store, so the lobby can use it.
// peekSize: the size of the peek, a part of the largest box that fits the window (peekSize.js).
export function CardPopup({ card, onClose, peek = false, peekSize = 1 }) {
  if (!card) return null

  return (
    <Overlay
      className={peek ? 'card-popup card-popup--peek' : 'card-popup'}
      onClick={peek ? undefined : onClose}
    >
      <div className="card-popup-content" onClick={(e) => e.stopPropagation()}>
        {card.tacticKey ? (
          <TacticFacePopup tacticKey={card.tacticKey} peekSize={peek ? peekSize : undefined} />
        ) : peek ? (
          <PeekImage key={card.src} card={card} size={peekSize} />
        ) : (
          <img className="card-popup-image" src={card.src} alt={card.alt} />
        )}
      </div>
    </Overlay>
  )
}

// The Alt peek of a card (useCardPeek.js). Reads the table store, so only inside a TableStoreProvider.
// It hides during a token or tool drag.
export function CardPeek({ card, size }) {
  const dragging = useTableStore((s) => !!(s.tokenDrag || s.toolDrag))
  if (dragging) return null
  return <CardPopup card={card} peek peekSize={size} />
}
