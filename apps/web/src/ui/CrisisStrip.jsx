import { assetUrl } from '../assets/index.js'
import { crisisCardFace } from '../crisis/files.js'
import '../rooms/comicBase.js'
import './streamer.css'

// The crisis cards in play, one bar each, under the scoreboard (docs/features/spectator-view.md, "Crisis strip").
// App renders it only while Streamer is on. items: crisisStripItems (crisisStrip.js). onOpen({ src, alt }): the
// card popup, the same call as a click on the card on the board end (crisis/CrisisCard.jsx).
export function CrisisStrip({ items, onOpen }) {
  if (items.length === 0) return null
  return (
    <nav className="comic crisis-strip" aria-label="Crisis cards in play">
      {items.map(({ type, label, key, name }) => (
        <button
          key={type}
          type="button"
          className="crisis-bar"
          title={name}
          onClick={() => onOpen({ src: assetUrl(crisisCardFace(key)), alt: 'Crisis card' })}
        >
          <span className={`crisis-tag crisis-tag--${type}`}>{label}</span>
          <span className="crisis-name">{name}</span>
        </button>
      ))}
    </nav>
  )
}
