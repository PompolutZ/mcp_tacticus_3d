import { assetUrl } from '../assets/index.js'
import { MAP_CARD_BACK } from '../terrain/files.js'
import './boardCard.css'

// The card of a custom board (docs/features/map-builder.md, "Board card"): the card back with the board name, "by <author>"
// and the top view in HTML over it, in the places of the map cards (assets/maps/*.webp). Used by the new room dialog
// and the lobby tile. className: more classes for the card (its size is the size of the box it gets: aspect 4 / 7).
// imageUrl: the top view, or none for the card back with the name only. author: '' shows no line.
export function BoardCard({ name, author = '', imageUrl = null, className = '' }) {
  return (
    <div className={`board-card ${className}`} role="img" aria-label={name}>
      <img className="board-card-back" src={assetUrl(MAP_CARD_BACK)} alt="" draggable={false} />
      <div className="board-card-title">{name}</div>
      {author && <div className="board-card-author">by {author}</div>}
      {imageUrl && <img className="board-card-view" src={imageUrl} alt="" draggable={false} />}
    </div>
  )
}
