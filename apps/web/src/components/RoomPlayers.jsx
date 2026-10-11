import { avatarUrl } from '../auth/avatar.js'
import { COLOR_NAME, useSideColors } from '../sideColors.js'

const TEAMS = ['blue', 'red']
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

// The two players of a multiplayer room in the toolbar (plan 08, decision 16): avatar and name in the side
// color, and the connection to the other player. side: the seat of this user. players: { blue, red } of the room,
// each a user, { gone: true } or null. connection: { state, peer, versionMismatch, retry } (net/peer.js). A free
// seat shows the player from the hello (connection.peer) once it arrives.
export function RoomPlayers({ side, players, connection }) {
  const colors = useSideColors()
  return (
    <div className="group room-players">
      {TEAMS.map((team) => {
        const own = team === side
        let player = players[team]
        if (!player && !own && connection?.peer) player = connection.peer
        let name = <span className="room-player-name">Free seat</span>
        if (player?.gone) name = <span className="room-player-name">Deleted player</span>
        else if (player)
          name = (
            <>
              <img
                className="room-player-avatar"
                src={avatarUrl(player, 40)}
                alt=""
                draggable={false}
              />
              <span className="room-player-name">{player.name}</span>
            </>
          )
        return (
          <span key={team} className={`room-player room-player--${colors[team]}`}>
            <span className="room-player-team">{COLOR_NAME[colors[team]]}</span>
            {name}
            {own && <span className="room-player-status">You</span>}
            {!own && player && !player.gone && connection && <Status connection={connection} />}
          </span>
        )
      })}
    </div>
  )
}

// The state of the connection, with Try again when it can help
function Status({ connection }) {
  const { state, retry } = connection
  const title = state === 'failed' ? FAILED_TITLE : undefined
  return (
    <>
      <span className={`room-player-status room-player-status--${state}`} title={title}>
        {STATUS[state]}
      </span>
      {(state === 'failed' || state === 'stopped') && (
        <button type="button" className="chip" onClick={retry}>
          Try again
        </button>
      )}
    </>
  )
}
