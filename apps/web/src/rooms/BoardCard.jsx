import { assetUrl } from '../assets/index.js'
import { MAP_CARD_FRONT } from '../terrain/files.js'
import './boardCard.css'

// The card of a custom board (docs/features/map-builder.md, "Board card"): the blank map card front
// (assets/maps/front.webp, 800 x 1400) with the board name, "Design Intent: Competitive", "Creator: <author>" and the top view in the square at the bottom.
// className: more classes for the card (its size is the size of the box it gets: aspect 4 / 7).
// imageUrl: the top view, or none for an empty square. author: '' shows no line.
export function BoardCard({ name, author = '', imageUrl = null, className = '' }) {
  return (
    <div
      className={`board-card ${className}`}
      style={{ backgroundImage: `url(${assetUrl(MAP_CARD_FRONT)})` }}
      role="img"
      aria-label={name}
    >
      <div className="board-card-title">{name}</div>
      <div className="board-card-line">Design Intent: Competitive</div>
      {author && <div className="board-card-line board-card-author">Creator: {author}</div>}
      {imageUrl ? (
        <img className="board-card-view" src={imageUrl} alt="" draggable={false} />
      ) : (
        <div className="board-card-view board-card-view-empty" />
      )}
    </div>
  )
}
