import { avatarUrl } from '../auth/avatar.js'
import { COLOR_NAME } from '../sideColors.js'
import { useSideColors } from '../table/useSideColors.jsx'
import { TEAMS } from '../setup/setup.js'

const STATUS = {
  waiting: 'Waiting',
  connecting: 'Connecting',
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  failed: 'Could not connect',
  stopped: 'Not here',
}
const FAILED_TITLE =
  'Could not connect directly. One of the networks blocks peer-to-peer connections.'

// The two players of a multiplayer room in the toolbar (docs/features/peer-to-peer.md, "Room and players"): a plate
// in the side color (the plate of SeatPlate.jsx, comic.css) with the avatar and the name, and a tag after it. side: the seat of this
// user. players: { host, guest } of the room, each a user, { gone: true } or null. connection: { state, peer,
// versionMismatch, retry } (net/peer.js). A free seat shows the player from the hello (connection.peer) once it
// arrives.
export function RoomPlayers({ side, players, connection }) {
  const colors = useSideColors()
  return (
    <>
      {TEAMS.map((team) => {
        const own = team === side
        let player = players[team]
        if (!player && !own && connection?.peer) player = connection.peer
        let plate = 'seat-plate--empty'
        let name = <span className="seat-name">Free seat</span>
        if (player?.gone) {
          plate = 'seat-plate--muted'
          name = <span className="seat-name">Deleted player</span>
        } else if (player) {
          plate = `seat-plate--${colors[team]}`
          name = (
            <>
              <img className="seat-avatar" src={avatarUrl(player, 40)} alt="" draggable={false} />
              <span className="seat-name">{player.name}</span>
            </>
          )
        }
        return (
          <span key={team} className="hud-player">
            <span className={`seat-plate ${plate}`} title={COLOR_NAME[colors[team]]}>
              {name}
            </span>
            {own && <span className="hud-tag hud-tag--you">You</span>}
            {!own && player && !player.gone && connection && <Status connection={connection} />}
          </span>
        )
      })}
    </>
  )
}

// The state of the connection, with Try again when it can help
function Status({ connection }) {
  const { state, retry } = connection
  const title = state === 'failed' ? FAILED_TITLE : undefined
  return (
    <>
      <span className={`hud-tag hud-tag--${state}`} title={title}>
        {STATUS[state]}
      </span>
      {(state === 'failed' || state === 'stopped') && (
        <button type="button" className="hud-chip" onClick={retry}>
          Try again
        </button>
      )}
    </>
  )
}
