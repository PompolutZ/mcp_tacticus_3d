import { assetUrl } from '../assets/index.js'
import { crisisCardFace } from '../crisis/files.js'

// Full-size popup of a crisis card face. Closes on a click outside the image.
// App also closes it on Escape, as App handles all keys.
export function CardPopup({ cardKey, onClose }) {
  if (!cardKey) return null

  return (
    <div className="card-popup" onClick={onClose}>
      <img className="card-popup-image" src={assetUrl(crisisCardFace(cardKey))} onClick={e => e.stopPropagation()} alt="Crisis card" />
    </div>
  )
}
