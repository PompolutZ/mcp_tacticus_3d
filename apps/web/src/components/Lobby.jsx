import { useEffect, useMemo, useState } from 'react'
import { assetUrl } from '../assets/index.js'
import { MAPS } from '../terrain/maps.js'
import { mapCard } from '../terrain/files.js'
import { deleteRoom, listRooms, ownsRoom } from '../rooms/store.js'
import { ROSTER_TABS, parseRosterText, rosterTabs } from '../rosters/cards.js'
import { CARD_STEP_KEYS } from '../keyboard.js'
import { UserMenu } from './UserMenu.jsx'
import { NewRoomDialog } from './NewRoomDialog.jsx'
import { RosterPopup } from './RosterPopup.jsx'

const TIME = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const TEAMS = ['blue', 'red']
const TEAM_NAMES = { blue: 'Blue', red: 'Red' }

// The start page (docs/feature-rooms.md, "Lobby"): the rooms of this browser, the last changed first, a
// tile that creates a room, and the Sandbox. Blue and Red on a tile show that roster of the room. notice: a
// message to show at the top, or null. onOpenRoom(id), onOpenSandbox(): open that page.
export function Lobby({ notice, onOpenRoom, onOpenSandbox }) {
  // The rooms of a map that the app no longer has cannot open, so they do not show
  const [rooms, setRooms] = useState(() => listRooms().filter((room) => MAPS[room.mapId]))
  const [creating, setCreating] = useState(false)
  // The roster in the roster popup: { room, team }, or null
  const [rosterView, setRosterView] = useState(null)

  // A browser confirm, the same as Remove on a character tray
  function handleDelete(room) {
    if (!window.confirm(`Delete room ${room.id} (${MAPS[room.mapId].name})? Its table is lost.`))
      return
    deleteRoom(room.id)
    setRooms((prev) => prev.filter((r) => r.id !== room.id))
  }

  return (
    <div className="lobby">
      <header className="lobby-header">
        <div>
          <h1 className="lobby-title">MCP Assist 3D</h1>
          <p className="lobby-subtitle">A game table for Marvel Crisis Protocol</p>
        </div>
        <UserMenu />
      </header>
      {notice && (
        <div className="lobby-notice" role="alert">
          {notice}
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
          {rooms.map((room) => (
            <div key={room.id} className="lobby-tile lobby-room">
              <button
                type="button"
                className="lobby-room-open"
                title={`Enter room ${room.id}`}
                onClick={() => onOpenRoom(room.id)}
              >
                <img
                  className="lobby-room-card"
                  src={assetUrl(mapCard(room.mapId))}
                  alt=""
                  draggable={false}
                />
                <span className="lobby-room-name">{MAPS[room.mapId].name}</span>
                <span className="lobby-room-code">{room.id}</span>
                <span className="lobby-room-time">Last change {TIME.format(room.updatedAt)}</span>
              </button>
              <div className="lobby-room-actions">
                {TEAMS.map(
                  (team) =>
                    room.rosters?.[team] && (
                      <button
                        key={team}
                        type="button"
                        className={`chip chip--player-${team}`}
                        title={`Show the ${TEAM_NAMES[team]} roster of room ${room.id}`}
                        onClick={() => setRosterView({ room, team })}
                      >
                        {TEAM_NAMES[team]}
                      </button>
                    ),
                )}
                {ownsRoom(room) && (
                  <button
                    type="button"
                    className="chip lobby-room-delete"
                    title={`Delete room ${room.id}`}
                    onClick={() => handleDelete(room)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
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
        />
      )}
      {rosterView && (
        <RoomRosterPopup
          key={`${rosterView.room.id}-${rosterView.team}`}
          team={rosterView.team}
          code={rosterView.room.rosters[rosterView.team].code}
          onClose={() => setRosterView(null)}
        />
      )}
    </div>
  )
}

// The roster popup of the table (RosterPopup.jsx) for a roster of a room. It opens on the first tab with
// cards. On the table, App owns the tab and the card, because App handles all keys there. The
// lobby has no key handler, so this component owns them: Escape closes the popup, and the left and right
// arrows show the previous or next card. The tab is a loop, the same as on the table.
// team: 'blue' | 'red'. code: the stored MCT code of the roster.
function RoomRosterPopup({ team, code, onClose }) {
  const tabs = useMemo(() => rosterTabs(parseRosterText(code)), [code])
  const [tab, setTab] = useState(() => ROSTER_TABS.find((t) => tabs[t.key].length > 0).key)
  const [index, setIndex] = useState(0)
  const count = tabs[tab].length

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
      else if (CARD_STEP_KEYS[e.code]) setIndex((i) => (i + CARD_STEP_KEYS[e.code] + count) % count)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [count, onClose])

  return (
    <RosterPopup
      team={team}
      code={code}
      tab={tab}
      index={index}
      onTabChange={(next) => {
        setTab(next)
        setIndex(0)
      }}
      onIndexChange={setIndex}
      onClose={onClose}
    />
  )
}
