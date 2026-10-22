import '../rooms/comicBase.js'
import './streamer.css'

// The crisis cards in play, one bar each, under the scoreboard (docs/features/spectator-view.md, "Crisis strip").
// App renders it only while Streamer is on. items: crisisStripItems (crisisStrip.js). Read-only and
// pointer-events none: viewers of a shared screen cannot click, so the player who shows it gets no controls.
export function CrisisStrip({ items }) {
  if (items.length === 0) return null
  return (
    <nav className="comic crisis-strip" aria-label="Crisis cards in play">
      {items.map(({ type, label, name }) => (
        <div key={type} className="crisis-bar">
          <span className={`crisis-tag crisis-tag--${type}`}>{label}</span>
          <span className="crisis-name">{name}</span>
        </div>
      ))}
    </nav>
  )
}
