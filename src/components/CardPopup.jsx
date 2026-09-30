import { useEffect } from 'react'
import { assetUrl } from '../assets/index.js'
import { crisisCardFace } from '../crisis/files.js'

// Full-size popup of a crisis card face. Closes on Escape or a click outside the image.
export function CardPopup({ cardKey, onClose }) {
  useEffect(() => {
    if (!cardKey) return undefined
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cardKey, onClose])

  if (!cardKey) return null

  return (
    <div className="card-popup" onClick={onClose}>
      <img className="card-popup-image" src={assetUrl(crisisCardFace(cardKey))} onClick={e => e.stopPropagation()} alt="Crisis card" />
    </div>
  )
}
