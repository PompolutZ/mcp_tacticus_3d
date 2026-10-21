import './boardCard.css'

// The card of a custom board (docs/features/map-builder.md, "Board card"): a front drawn in CSS like the map cards
// (assets/maps/*.webp, 800 x 1400): the board name, "by <author>" and the top view in the square at the bottom.
// className: more classes for the card (its size is the size of the box it gets: aspect 4 / 7).
// imageUrl: the top view, or none for an empty square. author: '' shows no line.
export function BoardCard({ name, author = '', imageUrl = null, className = '' }) {
  return (
    <div className={`board-card ${className}`} role="img" aria-label={name}>
      <div className="board-card-title">{name}</div>
      {author && <div className="board-card-author">by {author}</div>}
      {imageUrl ? (
        <img className="board-card-view" src={imageUrl} alt="" draggable={false} />
      ) : (
        <div className="board-card-view board-card-view-empty" />
      )}
    </div>
  )
}
