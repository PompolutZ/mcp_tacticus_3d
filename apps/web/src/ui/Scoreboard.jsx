import { scoreFromMarkers } from '../scoreboard/board.js'
import { Burst } from '../rooms/Burst.jsx'
import { PlayerTag } from '../rooms/RoomPlayers.jsx'
import { useTableStore } from '../table/TableStoreContext.jsx'
import { useSideColors } from '../table/useSideColors.jsx'
import { scoreboardSides } from './scoreboardSides.js'
import '../rooms/comicBase.js'
import './hud.css'

// The scoreboard at the top center (docs/features/table-tools.md, "Scoreboard"): the plate of the left player, its VP,
// the round burst, the VP and the plate of the right player. It shows at all times. The sides are the Streamer
// columns' sides (scoreboardSides.js). VP and the round come from the score markers (scoreFromMarkers); a VP marker
// on no spot counts 0, a round marker on no spot shows "-". connection: the room connection (net/peer.js), or
// null. When it does not fit between the boxes of the bar, useHudTop.js moves it to a row under the bar.
export function Scoreboard({ scoreMarkers, connection }) {
  const nameCtx = useTableStore((s) => s.nameCtx)
  const colors = useSideColors()
  const score = scoreFromMarkers(scoreMarkers)
  const [left, right] = scoreboardSides(nameCtx, colors, connection?.state)
  const round = score.round ?? '-'
  const plate = (side, edge) => (
    <div className={`seat-plate seat-plate--${side.color} score-plate score-plate--${edge}`}>
      <span className="score-name">{side.name}</span>
      <PlayerTag tag={side.tag} connection={connection} />
    </div>
  )
  const vp = (side, edge) => (
    <div
      className={`score-vp score-vp--${edge}`}
      aria-label={`${side.name}, ${score[side.team]} VP`}
    >
      <span aria-hidden="true" className="score-vp-number">
        {score[side.team]}
      </span>
      <span aria-hidden="true" className="score-vp-label">
        VP
      </span>
    </div>
  )
  return (
    <div className="comic scoreboard" role="group" aria-label="Score and round">
      {plate(left, 'left')}
      {vp(left, 'left')}
      <div className="score-round" aria-label={`Round ${round}`}>
        <Burst size={96} color="var(--yellow)" fontSize={40}>
          <span className="score-round-inner" aria-hidden="true">
            <span className="score-round-label">Round</span>
            <span>{round}</span>
          </span>
        </Burst>
      </div>
      {vp(right, 'right')}
      {plate(right, 'right')}
    </div>
  )
}
