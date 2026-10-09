import { useMemo, useState } from 'react'
import { assetUrl } from '../assets/index.js'
import { MAPS } from '../terrain/maps.js'
import { mapCard } from '../terrain/files.js'
import { avatarUrl } from '../auth/avatar.js'
import { DISCORD_ON, login } from '../auth/session.js'
import { useUser } from '../auth/useUser.js'
import { formatMctCode, isEmptyRoster } from '../rosters/mct.js'
import { parseRosterText } from '../rosters/cards.js'
import { joinRoom } from '../rooms/serverStore.js'
import { LobbyHeader } from './LobbyHeader.jsx'
import { RosterField } from './RosterField.jsx'
import { RoomRosterPopup } from './RoomRosterPopup.jsx'

const TEAM_NAMES = { blue: 'Blue', red: 'Red' }

// The join page of a multiplayer room with a free seat (plan 07, decision 20). room: the API room.
// onJoined(room): the user has the seat, and the room opens. onExit(): back to the lobby without joining.
export function JoinRoom({ room, onJoined, onExit }) {
  const { status } = useUser()
  const loggedIn = status === 'in'
  // The free side is the guest's. The host is on the other side.
  const side = room.players.blue ? 'red' : 'blue'
  const hostSide = side === 'blue' ? 'red' : 'blue'
  const host = room.players[hostSide]
  const hostRoster = room.rosters[hostSide]
  const [text, setText] = useState('')
  const parsed = useMemo(() => parseRosterText(text), [text])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [rosterOpen, setRosterOpen] = useState(false)
  // The same rule as the Blue field of the new room dialog: the text has a known code
  const canJoin = loggedIn && !isEmptyRoster(parsed) && !busy

  async function handleJoin(e) {
    e.preventDefault()
    if (!canJoin) return
    setBusy(true)
    try {
      onJoined(await joinRoom(room.code, { code: formatMctCode(parsed) }))
    } catch (err) {
      setError(`Could not join: ${err.message}`)
      setBusy(false)
    }
  }

  return (
    <div className="lobby">
      <LobbyHeader />
      <form className="join-room" onSubmit={handleJoin}>
        <img
          className="join-room-card"
          src={assetUrl(mapCard(room.mapId))}
          alt=""
          draggable={false}
        />
        <div className="join-room-body">
          <h2 className="join-room-title">Join room</h2>
          <span className="join-room-map">{MAPS[room.mapId].name}</span>
          <span className="join-room-code">{room.code}</span>
          <div className="join-room-host">
            <span className="group-label">Host</span>
            {host && !host.gone && (
              <>
                <img
                  className="lobby-seat-avatar"
                  src={avatarUrl(host, 40)}
                  alt=""
                  draggable={false}
                />
                <span>{host.name}</span>
              </>
            )}
            {host?.gone && <span>Deleted player</span>}
            {hostRoster && (
              <button
                type="button"
                className={`chip chip--player-${hostSide}`}
                title={`Show the ${TEAM_NAMES[hostSide]} roster of room ${room.code}`}
                onClick={() => setRosterOpen(true)}
              >
                {TEAM_NAMES[hostSide]} roster
              </button>
            )}
          </div>
          {loggedIn ? (
            <>
              <RosterField
                team={side}
                text={text}
                parsed={parsed}
                onChange={(value) => {
                  setText(value)
                  setError(null)
                }}
              />
              <p className="join-room-note">
                After you join, the players and the rosters of this room cannot change.
              </p>
            </>
          ) : DISCORD_ON ? (
            <button type="button" className="chip user-login" onClick={login}>
              Log in with Discord to join
            </button>
          ) : (
            <span className="new-room-hint">Log in above to join</span>
          )}
          {error && (
            <span className="new-room-error" role="alert">
              {error}
            </span>
          )}
          <div className="new-room-actions">
            <button type="button" className="chip" onClick={onExit}>
              ← Lobby
            </button>
            {loggedIn && (
              <button type="submit" className="chip chip--active" disabled={!canJoin}>
                Join
              </button>
            )}
          </div>
        </div>
      </form>
      {rosterOpen && (
        <RoomRosterPopup
          team={hostSide}
          code={hostRoster.code}
          onClose={() => setRosterOpen(false)}
        />
      )}
    </div>
  )
}
