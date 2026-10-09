import { useEffect, useMemo, useRef, useState } from 'react'
import { assetUrl } from '../assets/index.js'
import { MAPS } from '../terrain/maps.js'
import { MAP_CARD_BACK, mapCard } from '../terrain/files.js'
import { formatMctCode, isEmptyRoster } from '../rosters/mct.js'
import { parseRosterText } from '../rosters/cards.js'
import { DISCORD_ON } from '../auth/session.js'
import { useUser } from '../auth/useUser.js'
import { createRoom } from '../rooms/store.js'
import { createRoom as createServerRoom } from '../rooms/serverStore.js'
import { startTableBytes } from '../rooms/startTable.js'
import { CARD_STEP_KEYS, isEditing } from '../keyboard.js'
import { Carousel } from './Carousel.jsx'
import { Overlay } from './Overlay.jsx'
import { RosterField } from './RosterField.jsx'

const MAP_IDS = Object.keys(MAPS)
const TEAMS = ['blue', 'red']
const TEAM_NAMES = { blue: 'Blue', red: 'Red' }

// Why Multiplayer is disabled, by the session status
function unavailableText(status) {
  if (status === 'error') return 'Multiplayer is not available: the server does not answer.'
  if (status === 'loading') return 'Checking your login'
  return DISCORD_ON ? 'Log in with Discord to play multiplayer' : 'Log in to play multiplayer'
}

// The dialog that creates a room (docs/feature-rooms.md, "New room"): the map and the rosters of both
// players. With Random map on, the card back shows and the map is picked at creation. With it off, the map
// card in the middle of the carousel is the map. Create room needs a Blue roster. The Red roster is
// optional, because the Red field of the toolbar can load it later. Create room saves the room and calls
// onCreate(room). Escape, Cancel, × or a click on the backdrop calls onClose(). The left and right arrows
// move the carousel, the same as in the roster popup, but not while a roster field has the focus.
//
// Plan 07, decision 19: with login on, a choice at the top: Single player or Multiplayer. A multiplayer room
// has one roster field, for the own side (Blue or Red). Create room builds the start table, posts the room to
// the server, and calls onCreate({ id: code }). hostedCode: the code of the multiplayer room that the user
// hosts already, or null. The server allows one hosted room per user.
export function NewRoomDialog({ onCreate, onClose, hostedCode = null }) {
  const { status } = useUser()
  // Login off: no choice, and nothing here calls the API
  const authOn = status !== 'off'
  const loggedIn = status === 'in'
  const [choice, setChoice] = useState(null)
  const multiplayer = loggedIn && (choice ?? 'multiplayer') === 'multiplayer'
  const [side, setSide] = useState('blue')
  const [busy, setBusy] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [random, setRandom] = useState(true)
  const [mapIndex, setMapIndex] = useState(0)
  const [text, setText] = useState({ blue: '', red: '' })
  // The browser did not store the room
  const [failed, setFailed] = useState(false)
  const parsed = useMemo(
    () => ({ blue: parseRosterText(text.blue), red: parseRosterText(text.red) }),
    [text],
  )
  // A Red text without a known code blocks Create room, so a wrong paste does not make a room without Red
  const canCreate = multiplayer
    ? !isEmptyRoster(parsed[side]) && !hostedCode && !busy
    : !isEmptyRoster(parsed.blue) && (!text.red.trim() || !isEmptyRoster(parsed.red))
  // A carousel drag can end on the backdrop. The click then goes to the backdrop. So the backdrop
  // closes the dialog only when the press also started on the backdrop, the same as in RosterPopup.jsx.
  const pressedBackdrop = useRef(false)

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
      else if (!random && CARD_STEP_KEYS[e.code] && !isEditing(e.target)) {
        setMapIndex((i) => (i + CARD_STEP_KEYS[e.code] + MAP_IDS.length) % MAP_IDS.length)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [random, onClose])

  async function handleCreate(e) {
    e.preventDefault()
    if (!canCreate) return
    const mapId = random ? MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)] : MAP_IDS[mapIndex]
    const roster = (team) =>
      isEmptyRoster(parsed[team]) ? null : { code: formatMctCode(parsed[team]) }
    if (multiplayer) {
      const own = roster(side)
      const rosters = { blue: null, red: null, [side]: own }
      setBusy(true)
      try {
        const created = await createServerRoom({
          mapId,
          side,
          roster: own,
          table: startTableBytes(mapId, rosters),
        })
        onCreate({ id: created.code })
      } catch (err) {
        setCreateError(`Could not create the room: ${err.message}`)
        setBusy(false)
      }
      return
    }
    const room = createRoom(mapId, { blue: roster('blue'), red: roster('red') })
    if (room) onCreate(room)
    else setFailed(true)
  }

  function handleTextChange(team, value) {
    setText((prev) => ({ ...prev, [team]: value }))
    setFailed(false)
    setCreateError(null)
  }

  return (
    <Overlay
      className="new-room-backdrop"
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose()
      }}
    >
      <button type="button" className="popup-close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <form
        className="new-room"
        role="dialog"
        aria-modal="true"
        aria-label="New room"
        onSubmit={handleCreate}
      >
        <h2 className="new-room-title">New room</h2>
        {authOn && (
          <div className="new-room-choice">
            <div className="new-room-kinds" role="group" aria-label="Kind of room">
              <button
                type="button"
                className={multiplayer ? 'chip' : 'chip chip--active'}
                aria-pressed={!multiplayer}
                onClick={() => setChoice('single')}
              >
                Single player
              </button>
              <button
                type="button"
                className={multiplayer ? 'chip chip--active' : 'chip'}
                aria-pressed={multiplayer}
                disabled={!loggedIn}
                onClick={() => setChoice('multiplayer')}
              >
                Multiplayer
              </button>
            </div>
            {!loggedIn && <span className="new-room-hint">{unavailableText(status)}</span>}
            {multiplayer && hostedCode && (
              <span className="new-room-error">
                You host room {hostedCode} already. Delete it to create a new one.
              </span>
            )}
            {multiplayer && (
              <div className="new-room-kinds" role="group" aria-label="Your side">
                {TEAMS.map((team) => (
                  <button
                    key={team}
                    type="button"
                    className={`chip chip--player-${team}${side === team ? '' : ' new-room-side--off'}`}
                    aria-pressed={side === team}
                    onClick={() => setSide(team)}
                  >
                    {TEAM_NAMES[team]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className={random ? 'chip chip--active' : 'chip'}
          aria-pressed={random}
          title="On: the app picks the map when it creates the room. Off: choose the map below."
          onClick={() => setRandom((v) => !v)}
        >
          Random map
        </button>
        {random ? (
          <div className="new-room-random">
            <img
              className="new-room-card"
              src={assetUrl(MAP_CARD_BACK)}
              alt="Random map"
              draggable={false}
            />
            <span className="new-room-hint">The app picks the map when it creates the room</span>
          </div>
        ) : (
          <Carousel
            count={MAP_IDS.length}
            index={mapIndex}
            onIndexChange={setMapIndex}
            itemName="Map"
            renderSlide={(i) => (
              <img
                className="carousel-card new-room-card"
                src={assetUrl(mapCard(MAP_IDS[i]))}
                alt={MAPS[MAP_IDS[i]].name}
                draggable={false}
              />
            )}
          />
        )}
        {multiplayer ? (
          <RosterField
            key={side}
            team={side}
            text={text[side]}
            parsed={parsed[side]}
            onChange={(value) => handleTextChange(side, value)}
          />
        ) : (
          TEAMS.map((team) => (
            <RosterField
              key={team}
              team={team}
              text={text[team]}
              parsed={parsed[team]}
              optional={team !== 'blue'}
              onChange={(value) => handleTextChange(team, value)}
            />
          ))
        )}
        {createError && (
          <span className="new-room-error" role="alert">
            {createError}
          </span>
        )}
        {failed && (
          <span className="new-room-error" role="alert">
            The browser did not store the room. Its storage is full or turned off.
          </span>
        )}
        <div className="new-room-actions">
          <button type="button" className="chip" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="chip chip--active" disabled={!canCreate}>
            Create room
          </button>
        </div>
      </form>
    </Overlay>
  )
}
