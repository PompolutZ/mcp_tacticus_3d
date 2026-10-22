import { useMemo, useState } from 'react'
import { assetUrl } from '../assets/index.js'
import { RoomBoardCard } from './RoomBoardCard.jsx'
import { serverRoomBoard } from './roomBoard.js'
import { mapFace } from '../terrain/mapFace.js'
import { avatarUrl } from '../auth/avatar.js'
import { DISCORD_ON, login } from '../auth/session.js'
import { useUser } from '../auth/useUser.js'
import { formatMctCode, isEmptyRoster } from '../rosters/mct.js'
import { parseRosterText } from '../rosters/cards.js'
import { track } from '../analytics/track.js'
import { joinRoom } from './serverStore.js'
import { LobbyHeader } from './LobbyHeader.jsx'
import { SeatPlate } from './SeatPlate.jsx'
import { Burst } from './Burst.jsx'
import './joinRoom.css'
import { RosterField } from '../rosters/RosterField.jsx'
import { RoomRosterPopup } from '../rosters/RoomRosterPopup.jsx'

// The join page of a multiplayer room with a free seat (docs/features/rooms.md, "Join page"). room: the API room.
// onJoined(room): the user has the seat, and the room opens. onExit(): back to the lobby without joining.
export function JoinRoom({ room, onJoined, onExit }) {
  const { status, user } = useUser()
  const loggedIn = status === 'in'
  const board = serverRoomBoard(room)
  const face = mapFace(room.mapId, board?.name)
  const host = room.players.host
  const hostRoster = room.rosters.host
  const hostLabel = `${host?.gone ? 'Deleted player' : (host?.name ?? 'Host')} roster`
  const [text, setText] = useState('')
  const parsed = useMemo(() => parseRosterText(text), [text])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [rosterOpen, setRosterOpen] = useState(false)
  // ready: the text has a known code (the same rule as the Blue field of the new room dialog)
  const ready = loggedIn && !isEmptyRoster(parsed)
  const canJoin = ready && !busy

  async function handleJoin(e) {
    e.preventDefault()
    if (!canJoin) return
    setBusy(true)
    try {
      const joined = await joinRoom(room.code, { code: formatMctCode(parsed) })
      track('room_join', 'versus')
      onJoined(joined)
    } catch (err) {
      setError(`Could not join: ${err.message}`)
      setBusy(false)
    }
  }

  return (
    <div className="lobby comic comic-page">
      <LobbyHeader />
      <div className="join-room">
        <div className="join-room-map">
          <span className="join-room-caption">Incoming challenge!</span>
          {board ? (
            <RoomBoardCard className="join-room-card" code={room.code} multiplayer board={board} />
          ) : (
            <img className="join-room-card" src={assetUrl(face.src)} alt="" draggable={false} />
          )}
        </div>
        <form className="join-room-panel" onSubmit={handleJoin}>
          <div className="join-room-tag">
            <span className="join-room-tag-label">Room</span>
            <span className="join-room-code">{room.code}</span>
          </div>
          <div>
            <div className="join-room-kicker">Join room</div>
            <h2 className="join-room-title">{face.name}</h2>
            {room.mapId === null && (
              <span className="join-room-hint">The map spawns when you join.</span>
            )}
          </div>
          <div className="join-room-seats">
            <div className="join-room-seat">
              <span className="join-room-label">Host</span>
              <SeatPlate
                name={host?.gone ? 'Deleted player' : (host?.name ?? 'Host')}
                avatar={host && !host.gone ? avatarUrl(host, 40) : null}
                muted={!host || host.gone}
                label={`Show the ${hostLabel} of room ${room.code}`}
                rosterText="View roster ›"
                onRoster={hostRoster ? () => setRosterOpen(true) : null}
              />
            </div>
            <span className="join-room-vs">
              <Burst size={84} color="var(--yellow)" fontSize={30}>
                <span className="room-vs-text">VS</span>
              </Burst>
            </span>
            <div className="join-room-seat join-room-seat--end">
              <span className="join-room-label">Challenger</span>
              <SeatPlate
                align="end"
                name={ready ? (user?.name ?? 'You') : 'You?'}
                avatar={ready && user ? avatarUrl(user, 40) : null}
                empty={!ready}
                note={ready ? 'Roster ready' : 'Paste a roster below'}
              />
            </div>
          </div>
          {loggedIn ? (
            <>
              <RosterField
                label="Your roster"
                text={text}
                parsed={parsed}
                onChange={(value) => {
                  setText(value)
                  setError(null)
                }}
              />
              <p className="join-room-note">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 3l10 18H2z" />
                  <path d="M12 10v5M12 18v.5" />
                </svg>
                <span>
                  Heads up! Once you join, the players and rosters of this room are locked in.
                </span>
              </p>
            </>
          ) : DISCORD_ON ? (
            <button type="button" className="comic-button pop user-login" onClick={login}>
              Log in with Discord to join
            </button>
          ) : (
            <span className="join-room-hint">Log in above to join</span>
          )}
          {error && (
            <span className="join-room-error" role="alert">
              {error}
            </span>
          )}
          <div className="join-room-actions">
            <button type="button" className="join-room-back pop" onClick={onExit}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
              Lobby
            </button>
            {loggedIn && (
              <button
                type="submit"
                className="comic-go pop"
                disabled={!canJoin}
                title={canJoin || busy ? undefined : 'Paste your roster first'}
              >
                Join the fight!
              </button>
            )}
          </div>
        </form>
      </div>
      {rosterOpen && (
        <RoomRosterPopup
          title={hostLabel}
          roomCode={room.code}
          seat="host"
          code={hostRoster.code}
          onClose={() => setRosterOpen(false)}
        />
      )}
    </div>
  )
}
