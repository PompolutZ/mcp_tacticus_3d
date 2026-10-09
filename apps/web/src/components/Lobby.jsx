import { useEffect, useMemo, useState } from 'react'
import { assetUrl } from '../assets/index.js'
import { MAPS } from '../terrain/maps.js'
import { mapCard } from '../terrain/files.js'
import { avatarUrl } from '../auth/avatar.js'
import { useUser } from '../auth/useUser.js'
import { deleteDoc, deleteRoom, listRooms, multiplayerDocName, ownsRoom } from '../rooms/store.js'
import * as server from '../rooms/serverStore.js'
import { deleteStaleDocs } from '../rooms/localDocs.js'
import { roomList } from '../rooms/roomList.js'
import { LobbyHeader } from './LobbyHeader.jsx'
import { NewRoomDialog } from './NewRoomDialog.jsx'
import { RoomRosterPopup } from './RoomRosterPopup.jsx'
import { CopyLinkButton } from './CopyLinkButton.jsx'

const TIME = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const TEAMS = ['blue', 'red']
const TEAM_NAMES = { blue: 'Blue', red: 'Red' }

// A seat of a multiplayer tile: avatar and name, "Free seat", or "Deleted player"
function Seat({ team, player }) {
  let content = <span className="lobby-seat-name">Free seat</span>
  if (player?.gone) content = <span className="lobby-seat-name">Deleted player</span>
  else if (player)
    content = (
      <>
        <img className="lobby-seat-avatar" src={avatarUrl(player, 40)} alt="" draggable={false} />
        <span className="lobby-seat-name">{player.name}</span>
      </>
    )
  return (
    <div className={`lobby-seat lobby-seat--${team}`}>
      <span className="lobby-seat-team">{TEAM_NAMES[team]}</span>
      {content}
    </div>
  )
}

// The start page (docs/feature-rooms.md, "Lobby"): the single player and the multiplayer rooms in one list,
// the last changed first, a tile that creates a room, and the Sandbox. Blue and Red on a tile show that
// roster of the room. notice: a message to show at the top, or null. onOpenRoom(id), onOpenSandbox(): open
// that page.
export function Lobby({ notice, onOpenRoom, onOpenSandbox }) {
  const { status, user } = useUser()
  // The multiplayer rooms need a login. With login off or logged out, no API call is made: the effect below
  // returns before the request when status is not 'in'.
  const loggedIn = status === 'in'
  const userId = user?.id
  const [single, setSingle] = useState(() => listRooms())
  // The API rooms { userId, list }, or null before the first answer. userId keeps the rooms of a user who
  // logged out away from the next user. failed: the user id whose load failed, or null.
  const [loaded, setLoaded] = useState(null)
  const [failed, setFailed] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [creating, setCreating] = useState(false)
  // The roster in the roster popup: { room, team }, or null
  const [rosterView, setRosterView] = useState(null)

  // Each time the lobby shows, and when the user changes
  useEffect(() => {
    if (!loggedIn) return
    let cancelled = false
    server
      .listRooms()
      .then((list) => {
        if (cancelled) return
        setLoaded({ userId, list })
        setFailed(null)
        // A room that the host deleted leaves no copy in this browser (plan 07, decision 12)
        deleteStaleDocs(
          userId,
          list.map((room) => room.code),
        )
      })
      .catch(() => {
        if (cancelled) return
        setLoaded(null)
        setFailed(userId)
      })
    return () => {
      cancelled = true
    }
  }, [loggedIn, userId])

  const multiplayer = useMemo(
    () => (loggedIn && loaded?.userId === userId ? loaded.list : []),
    [loggedIn, loaded, userId],
  )
  const items = useMemo(() => roomList(single, multiplayer), [single, multiplayer])
  const hosted = multiplayer.find((room) => room.host === userId)

  // A browser confirm, the same as Remove on a character tray
  async function handleDelete(item) {
    if (!window.confirm(`Delete room ${item.id} (${MAPS[item.mapId].name})? Its table is lost.`))
      return
    if (item.kind === 'single') {
      deleteRoom(item.id)
      setSingle((prev) => prev.filter((r) => r.id !== item.id))
      return
    }
    try {
      await server.deleteRoom(item.id)
    } catch (err) {
      // 404: the room is gone already
      if (err.status !== 404) {
        setActionError(`Could not delete the room: ${err.message}`)
        return
      }
    }
    setActionError(null)
    deleteDoc(multiplayerDocName(userId, item.id))
    setLoaded((prev) => prev && { ...prev, list: prev.list.filter((r) => r.code !== item.id) })
  }

  return (
    <div className="lobby">
      <LobbyHeader />
      {notice && (
        <div className="lobby-notice" role="alert">
          {notice}
        </div>
      )}
      {loggedIn && failed === userId && (
        <div className="lobby-notice" role="alert">
          Could not load your multiplayer rooms
        </div>
      )}
      {actionError && (
        <div className="lobby-notice" role="alert">
          {actionError}
        </div>
      )}
      <section>
        <h2 className="lobby-section-title">Rooms</h2>
        <div className="lobby-rooms">
          <button type="button" className="lobby-tile lobby-new" onClick={() => setCreating(true)}>
            <span className="lobby-new-plus" aria-hidden="true">
              +
            </span>
            <span>New room</span>
          </button>
          {items.map((item) => {
            const room = item.room
            const isMulti = item.kind === 'multiplayer'
            const isHost = isMulti ? room.host === userId : ownsRoom(room)
            return (
              <div key={`${item.kind}-${item.id}`} className="lobby-tile lobby-room">
                <button
                  type="button"
                  className="lobby-room-open"
                  title={`Enter room ${item.id}`}
                  onClick={() => onOpenRoom(item.id)}
                >
                  <img
                    className="lobby-room-card"
                    src={assetUrl(mapCard(item.mapId))}
                    alt=""
                    draggable={false}
                  />
                  <span className="lobby-room-name">{MAPS[item.mapId].name}</span>
                  <span className="lobby-room-code">{item.id}</span>
                  <span className="lobby-room-time">Last change {TIME.format(item.updatedAt)}</span>
                  {isMulti ? (
                    <span className="lobby-seats">
                      {TEAMS.map((team) => (
                        <Seat key={team} team={team} player={room.players[team]} />
                      ))}
                    </span>
                  ) : (
                    <span className="lobby-room-kind">Single player</span>
                  )}
                </button>
                <div className="lobby-room-actions">
                  {TEAMS.map(
                    (team) =>
                      item.rosters?.[team] && (
                        <button
                          key={team}
                          type="button"
                          className={`chip chip--player-${team}`}
                          title={`Show the ${TEAM_NAMES[team]} roster of room ${item.id}`}
                          onClick={() =>
                            setRosterView({ id: item.id, team, rosters: item.rosters })
                          }
                        >
                          {TEAM_NAMES[team]}
                        </button>
                      ),
                  )}
                  {isMulti && (!room.players.blue || !room.players.red) && (
                    <CopyLinkButton code={item.id} />
                  )}
                  {isHost && (
                    <button
                      type="button"
                      className="chip lobby-room-delete"
                      title={`Delete room ${item.id}`}
                      onClick={() => handleDelete(item)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
      <section>
        <h2 className="lobby-section-title">Sandbox</h2>
        <button type="button" className="lobby-sandbox" onClick={onOpenSandbox}>
          <span className="lobby-sandbox-title">Open Sandbox</span>
          <span className="lobby-sandbox-text">
            A free table: every map, both rosters. Nothing is saved.
          </span>
        </button>
      </section>
      {creating && (
        <NewRoomDialog
          onClose={() => setCreating(false)}
          onCreate={(room) => onOpenRoom(room.id)}
          hostedCode={hosted?.code ?? null}
        />
      )}
      {rosterView && (
        <RoomRosterPopup
          key={`${rosterView.id}-${rosterView.team}`}
          team={rosterView.team}
          code={rosterView.rosters[rosterView.team].code}
          onClose={() => setRosterView(null)}
        />
      )}
    </div>
  )
}
