import { Fragment, useEffect, useMemo, useState } from 'react'
import { assetUrl } from '../assets/index.js'
import { mapFace } from '../terrain/mapFace.js'
import { avatarUrl } from '../auth/avatar.js'
import { useUser } from '../auth/useUser.js'
import { deleteDoc, deleteRoom, listRooms, multiplayerDocName, ownsRoom } from './store.js'
import * as server from './serverStore.js'
import { deleteStaleDocs, deleteStaleRooms, deleteStaleSquads } from './localDocs.js'
import { roomList, rosterLinks } from './roomList.js'
import { LobbyHeader } from './LobbyHeader.jsx'
import { LobbyHero } from './LobbyHero.jsx'
import { NewRoomDialog } from './NewRoomDialog.jsx'
import { RoomRosterPopup } from '../rosters/RoomRosterPopup.jsx'
import { CopyLinkButton } from './CopyLinkButton.jsx'
import { SeatPlate } from './SeatPlate.jsx'
import { Burst } from './Burst.jsx'
import { COLOR_NAME } from '../sideColors.js'
import { TEAMS } from '../setup/setup.js'

const COFFEE_URL = 'https://buymeacoffee.com/olehlutsenl'

// The cup, in the Like Coffee link and the footer link. steam: the two steam lines above the cup.
function CoffeeCup({ size, steam }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" fill={steam ? 'var(--paper)' : 'none'} />
      <path d="M16 11h2a3 3 0 0 1 0 6h-2.5" />
      {steam && <path d="M8 2.5c-1 1.2 1 2.3 0 3.5M12 2.5c-1 1.2 1 2.3 0 3.5" />}
    </svg>
  )
}

const TIME = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

// The start page (docs/features/rooms.md, "Lobby"): the single player and the multiplayer rooms in one list,
// the last changed first, a tile that creates a room, and the Sandbox. Only Enter the fight opens a room. A roster link on a tile shows that
// roster of the room (rosterLinks). notice: a message to show at the top, or null. onOpenRoom(id), onOpenSandbox(): open
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

  // Single player rooms of an older record version cannot be listed or opened (docs/features/rooms.md, "Storage")
  useEffect(() => {
    deleteStaleRooms()
  }, [])

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
        // A room that the host deleted leaves no copy in this browser (docs/features/rooms.md, "Storage")
        const codes = list.map((room) => room.code)
        deleteStaleDocs(userId, codes)
        deleteStaleSquads(userId, codes)
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
    if (!window.confirm(`Delete room ${item.id} (${mapFace(item.mapId).name})? Its table is lost.`))
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

  function openRoster(item, { team, color, label }) {
    // The seat of the line above the title: the host or guest of a multiplayer room, the color of a single player side
    const seat = item.kind === 'multiplayer' ? (team === 'host' ? 'host' : 'guest') : color
    setRosterView({ id: item.id, team, rosters: item.rosters, color, label, seat })
  }

  return (
    <div className="lobby comic comic-page">
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
      <LobbyHero
        onNewRoom={() => setCreating(true)}
        onOpenSandbox={onOpenSandbox}
        onOpenRoom={onOpenRoom}
      />
      <section className="lobby-rooms-section" aria-labelledby="lobby-rooms-title">
        <div className="lobby-rooms-head">
          <h2 id="lobby-rooms-title" className="lobby-section-title">
            Your rooms
          </h2>
          {items.length > 0 && (
            <span className="lobby-count">
              {items.length === 1 ? '1 battle in progress' : `${items.length} battles in progress`}
            </span>
          )}
        </div>
        <div className="lobby-rooms">
          {items.map((item, index) => {
            const room = item.room
            const isMulti = item.kind === 'multiplayer'
            const face = mapFace(item.mapId)
            const links = new Map(rosterLinks(item).map((link) => [link.team, link]))
            const isHost = isMulti ? room.host === userId : ownsRoom(room)
            const plates = isMulti
              ? TEAMS.map((team) => {
                  const player = room.players[team]
                  const link = links.get(team)
                  return {
                    team,
                    name: player?.gone ? 'Deleted player' : (player?.name ?? 'Free seat'),
                    avatar: player && !player.gone ? avatarUrl(player, 40) : null,
                    muted: !player || player.gone,
                    color: null,
                    link,
                  }
                })
              : [...links].map(([team, link]) => ({
                  team,
                  name: link.color ? COLOR_NAME[link.color] : link.label,
                  avatar: null,
                  muted: false,
                  color: link.color,
                  link,
                }))
            return (
              <article
                key={`${item.kind}-${item.id}`}
                className={`room-tile${index % 2 ? ' room-tile--odd' : ''}`}
              >
                <div className="room-badge">
                  <span className="room-badge-label">Room</span>
                  <span className="room-badge-code">{item.id}</span>
                  {isMulti && (!room.players.host || !room.players.guest) && (
                    <CopyLinkButton code={item.id} />
                  )}
                </div>
                <div className="room-body">
                  <img
                    className="room-card"
                    src={assetUrl(face.src)}
                    alt={face.name}
                    draggable={false}
                  />
                  <div className="room-info">
                    <div>
                      <span className="room-tag">{isMulti ? 'Versus' : 'Solo'}</span>
                    </div>
                    <h3 className="room-name">{face.name}</h3>
                    <div className="room-time">Last change {TIME.format(item.updatedAt)}</div>
                    {plates.length > 0 && (
                      <div className="room-seats">
                        {plates.map((plate, i) => (
                          <Fragment key={plate.team}>
                            {i > 0 && (
                              <span className="room-vs">
                                <Burst size={64} color="var(--yellow)">
                                  <span className="room-vs-text">VS</span>
                                </Burst>
                              </span>
                            )}
                            <SeatPlate
                              name={plate.name}
                              color={plate.color}
                              avatar={plate.avatar}
                              muted={plate.muted}
                              align={i > 0 ? 'end' : undefined}
                              label={plate.link?.label}
                              onRoster={
                                plate.link && (!isMulti || item.rosters?.[plate.team])
                                  ? () => openRoster(item, plate.link)
                                  : null
                              }
                            />
                          </Fragment>
                        ))}
                      </div>
                    )}
                    <div className="room-actions">
                      {isHost && (
                        <button
                          type="button"
                          className="comic-button comic-button--small room-delete"
                          title={`Delete room ${item.id}`}
                          onClick={() => handleDelete(item)}
                        >
                          Delete
                        </button>
                      )}
                      <button
                        type="button"
                        className="pop room-enter"
                        title={`Enter room ${item.id}`}
                        onClick={() => onOpenRoom(item.id)}
                      >
                        Enter the fight
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
          <button type="button" className="pop room-new" onClick={() => setCreating(true)}>
            <Burst size={120} color="var(--yellow)">
              <svg
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--ink)"
                strokeWidth="4"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 4v16M4 12h16" />
              </svg>
            </Burst>
            <span className="room-new-title">Start a new room!</span>
            <span className="room-new-text">Solo or versus</span>
            <span className="room-new-corner">To be continued…</span>
          </button>
        </div>
      </section>
      <section className="lobby-sandbox" aria-labelledby="lobby-sandbox-title">
        <img className="lobby-sandbox-image" src={assetUrl('lobby/sandbox.webp')} alt="" />
        <div className="lobby-sandbox-dots" />
        <div className="lobby-sandbox-content">
          <div className="lobby-sandbox-bubble">
            <h2 id="lobby-sandbox-title" className="lobby-sandbox-title">
              The sandbox!
            </h2>
            <p className="lobby-sandbox-text">
              Every map, both rosters. Try lists and set-ups — nothing is saved, so go wild.
            </p>
            <button type="button" className="pop lobby-sandbox-open" onClick={onOpenSandbox}>
              Open sandbox
            </button>
          </div>
        </div>
        <span className="lobby-sandbox-wham" aria-hidden="true">
          Wham!
        </span>
      </section>
      <div className="lobby-coffee-row">
        <a className="pop lobby-coffee" href={COFFEE_URL} target="_blank" rel="noopener">
          <Burst size={46} color="var(--yellow)">
            <span style={{ color: 'var(--ink)', display: 'flex' }}>
              <CoffeeCup size={26} steam />
            </span>
          </Burst>
          <span className="lobby-coffee-text">
            <span className="lobby-coffee-label">Even heroes need fuel</span>
            <span className="lobby-coffee-title">Like Coffee!</span>
          </span>
        </a>
      </div>
      <footer className="lobby-footer">
        <div className="lobby-footer-row">
          <span>Hero Table 3D · a fan-made tabletop</span>
          <span className="lobby-footer-links">
            <a className="lobby-fuel" href={COFFEE_URL} target="_blank" rel="noopener">
              <CoffeeCup size={18} />
              Fuel the next issue
            </a>
            <a href="/privacy.html">Privacy</a>
          </span>
        </div>
        <p className="lobby-disclaimer">
          This site is not endorsed by nor affiliated with Marvel or Atomic Mass Games in any way.
          All trademarks mentioned here are the property of their respective owners.
        </p>
      </footer>
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
          title={
            rosterView.color ? `${COLOR_NAME[rosterView.color]} player roster` : rosterView.label
          }
          color={rosterView.color}
          roomCode={rosterView.id}
          seat={rosterView.seat}
          code={rosterView.rosters[rosterView.team].code}
          onClose={() => setRosterView(null)}
        />
      )}
    </div>
  )
}
