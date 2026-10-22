import { FAILED_TITLE } from './connectionStatus.js'

// The tag under the name of a player on the scoreboard (ui/Scoreboard.jsx, docs/features/peer-to-peer.md, "Room and
// players"). tag: { kind, text } of scoreboardSides (ui/scoreboardSides.js): "You", or the state of the connection.
// connection: { state, retry } (net/peer.js). A failed or stopped connection gets Try again.
export function PlayerTag({ tag, connection }) {
  if (!tag) return null
  const title = tag.kind === 'failed' ? FAILED_TITLE : undefined
  const retry = tag.kind === 'failed' || tag.kind === 'stopped' ? connection?.retry : null
  return (
    <span className="score-tags">
      <span className={`hud-tag hud-tag--${tag.kind}`} title={title}>
        {tag.text}
      </span>
      {retry && (
        <button type="button" className="hud-chip" onClick={retry}>
          Try again
        </button>
      )}
    </span>
  )
}
