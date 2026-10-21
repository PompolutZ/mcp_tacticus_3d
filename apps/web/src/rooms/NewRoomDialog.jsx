import { useEffect, useMemo, useState } from 'react'
import { assetUrl, hasAsset } from '../assets/index.js'
import { MAPS } from '../terrain/maps/index.js'
import { MAP_CARD_BACK, mapCard } from '../terrain/files.js'
import { getBoardInfo } from '../api/board.js'
import { MAP_IDS, carouselIds, myBoardChoice } from './myBoard.js'
import { BoardCard } from './BoardCard.jsx'
import { useBoardImageUrl } from './useBoardImageUrl.js'
import { CUSTOM_MAP_ID } from './table.js'
import { formatMctCode, isEmptyRoster } from '../rosters/mct.js'
import { parseRosterText } from '../rosters/cards.js'
import { DISCORD_ON } from '../auth/session.js'
import { useUser } from '../auth/useUser.js'
import { createRoom } from './store.js'
import { createRoom as createServerRoom } from './serverStore.js'
import { startTableBytes } from './startTable.js'
import { CARD_STEP_KEYS, isEditing } from '../keyboard.js'
import { Carousel } from '../ui/Carousel.jsx'
import { Dialog } from '../ui/Dialog.jsx'
import { Switch } from '../ui/Switch.jsx'
import { COLOR_NAME, DEFAULT_SIDE_COLORS as START_COLORS } from '../sideColors.js'
import { TEAMS } from '../setup/setup.js'
import { RosterField } from '../rosters/RosterField.jsx'
import './comicBase.js'
import './newRoom.css'

// The attributes of the arrow icons of the map buttons
const ARROW = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

// Why Versus is disabled, by the session status
function unavailableText(status) {
  if (status === 'error') return 'Versus is not available: the server does not answer.'
  if (status === 'loading') return 'Checking your login'
  return DISCORD_ON ? 'Log in with Discord to play versus' : 'Log in to play versus'
}

// The dialog that creates a room (docs/features/rooms.md, "New room", for the look and the rules): the map on the
// left (rooms/newRoom.css), the choice, Random map and the rosters on the right. With Random map on, the card
// back shows; with it off, the map card in the middle of the fan carousel is the map. Create room! needs a Blue
// roster. The Red roster is optional, because the Red field of the toolbar can load it later. It saves the room
// and calls onCreate(room). Escape (Dialog.jsx), Cancel, × or a click on the backdrop calls onClose(). The left
// and right arrows move the carousel, but not while a roster field has the focus.
//
// With login on: a choice at the top, Solo or Versus (code names: single, multiplayer). Solo: the app picks a
// random map at creation. Versus: one roster field, for the own side (the host always sits at +z), and the server
// picks a random map when the guest joins. Create room! builds the start table, posts the room to
// the server, and calls onCreate({ id: code }). hostedCode: the code of the multiplayer room that the user
// hosts already, or null. The server allows one hosted room per user.
export function NewRoomDialog({ onCreate, onClose, hostedCode = null }) {
  const { status } = useUser()
  // Login off: no choice, and nothing here calls the API
  const authOn = status !== 'off'
  const loggedIn = status === 'in'
  const [choice, setChoice] = useState(null)
  const multiplayer = loggedIn && (choice ?? 'multiplayer') === 'multiplayer'
  const [busy, setBusy] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [random, setRandom] = useState(true)
  const [mapIndex, setMapIndex] = useState(0)
  // The saved board of the account ({ board, name }), or null: no login, none saved, or not loaded yet
  const [savedBoard, setMyBoard] = useState(null)
  const myBoard = loggedIn ? savedBoard : null
  const ids = carouselIds(myBoard)
  const boardImage = useBoardImageUrl(Boolean(myBoard?.hasImage))
  const mapName = (id) => (id === CUSTOM_MAP_ID ? myBoard.name : MAPS[id].name)
  const mapImage = (id) =>
    id !== CUSTOM_MAP_ID && hasAsset(mapCard(id)) ? mapCard(id) : MAP_CARD_BACK
  const [text, setText] = useState({ host: '', guest: '' })
  // The browser did not store the room
  const [failed, setFailed] = useState(false)
  const parsed = useMemo(
    () => ({ host: parseRosterText(text.host), guest: parseRosterText(text.guest) }),
    [text],
  )
  // A Red text without a known code blocks Create room, so a wrong paste does not make a room without Red
  const canCreate = multiplayer
    ? !isEmptyRoster(parsed.host) && !hostedCode && !busy
    : !isEmptyRoster(parsed.host) && (!text.guest.trim() || !isEmptyRoster(parsed.guest))

  useEffect(() => {
    if (!loggedIn) return
    let cancelled = false
    getBoardInfo()
      .then((saved) => {
        if (!cancelled) setMyBoard(saved && myBoardChoice(saved.board, saved.hasImage))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [loggedIn])

  useEffect(() => {
    function handleKeyDown(e) {
      if (!random && CARD_STEP_KEYS[e.code] && !isEditing(e.target)) {
        setMapIndex((i) => (i + CARD_STEP_KEYS[e.code] + ids.length) % ids.length)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [random, ids.length])

  async function handleCreate(e) {
    e.preventDefault()
    if (!canCreate) return
    // Multiplayer and random: the server picks the map when the guest joins, so the table has no map
    // A random room never gets the board (MAP_IDS has only the maps)
    const mapId = random
      ? MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)]
      : ids[Math.min(mapIndex, ids.length - 1)]
    const board = mapId === CUSTOM_MAP_ID ? myBoard.board : null
    const roster = (team) =>
      isEmptyRoster(parsed[team]) ? null : { code: formatMctCode(parsed[team]) }
    if (multiplayer) {
      const own = roster('host')
      const rosters = { host: own, guest: null }
      setBusy(true)
      try {
        const created = await createServerRoom({
          ...(random ? { maps: MAP_IDS } : { mapId }),
          roster: own,
          table: startTableBytes(random ? null : mapId, rosters, board),
        })
        onCreate({ id: created.code })
      } catch (err) {
        setCreateError(`Could not create the room: ${err.message}`)
        setBusy(false)
      }
      return
    }
    const room = createRoom(mapId, { host: roster('host'), guest: roster('guest') }, board)
    if (room) onCreate(room)
    else setFailed(true)
  }

  function handleTextChange(team, value) {
    setText((prev) => ({ ...prev, [team]: value }))
    setFailed(false)
    setCreateError(null)
  }

  const footNote = multiplayer
    ? random
      ? 'The map is revealed when the second player joins…'
      : 'Your rival will fight on this map…'
    : 'Red roster is optional — add it now or at the table.'
  const createTitle = canCreate
    ? undefined
    : multiplayer && hostedCode
      ? 'You host a room already'
      : 'Paste a roster first'

  return (
    <Dialog
      as="form"
      backdropClassName="new-room-backdrop"
      className="comic new-room-comic"
      closeClassName="new-room-comic-close"
      label="New room"
      onClose={onClose}
      onSubmit={handleCreate}
    >
      <section className="new-room-map">
        <div className="new-room-caption">
          {random ? 'A mystery map awaits…' : 'Pick your battleground!'}
        </div>
        {random ? (
          <>
            <div className="new-room-stage">
              <img
                className="new-room-card new-room-card--back"
                src={assetUrl(MAP_CARD_BACK)}
                alt="Random map"
                draggable={false}
              />
            </div>
            <div className="new-room-nav-space" />
          </>
        ) : (
          <Carousel
            key={ids.length}
            fan
            count={ids.length}
            index={mapIndex}
            onIndexChange={setMapIndex}
            itemName="Map"
            renderSlide={(i) =>
              ids[i] === CUSTOM_MAP_ID ? (
                <BoardCard
                  className="carousel-card new-room-card"
                  name={myBoard.name}
                  author={myBoard.author}
                  imageUrl={boardImage}
                />
              ) : (
                <img
                  className="carousel-card new-room-card"
                  src={assetUrl(mapImage(ids[i]))}
                  alt={mapName(ids[i])}
                  draggable={false}
                />
              )
            }
            renderNav={({ index, count, prev, next }) => (
              <div className="new-room-nav">
                <button
                  type="button"
                  className="new-room-square pop"
                  aria-label="Previous map"
                  onClick={prev}
                >
                  <svg {...ARROW} aria-hidden="true">
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                </button>
                <div className="new-room-nav-box" aria-live="polite">
                  <div className="new-room-nav-count">
                    Map {index + 1} of {count}
                  </div>
                  <div className="new-room-nav-name">{mapName(ids[index])}</div>
                  {ids[index] === CUSTOM_MAP_ID && myBoard.author && (
                    <div className="new-room-nav-author">by {myBoard.author}</div>
                  )}
                </div>
                <button
                  type="button"
                  className="new-room-square pop"
                  aria-label="Next map"
                  onClick={next}
                >
                  <svg {...ARROW} aria-hidden="true">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          />
        )}
      </section>
      <div className="new-room-side">
        <h2 className="new-room-heading">New room!</h2>
        {authOn && (
          <fieldset className="new-room-kinds">
            <legend>Choose your battle</legend>
            <button
              type="button"
              className={multiplayer ? 'new-room-kind pop' : 'new-room-kind new-room-kind--on pop'}
              aria-pressed={!multiplayer}
              onClick={() => setChoice('single')}
            >
              <span className="new-room-kind-name">Solo</span>
              <span className="new-room-kind-text">Run both sides yourself</span>
            </button>
            <button
              type="button"
              className={multiplayer ? 'new-room-kind new-room-kind--on pop' : 'new-room-kind pop'}
              aria-pressed={multiplayer}
              disabled={!loggedIn}
              onClick={() => setChoice('multiplayer')}
            >
              <span className="new-room-kind-name">Versus</span>
              <span className="new-room-kind-text">Share a code with a friend</span>
            </button>
            {!loggedIn && <span className="new-room-note">{unavailableText(status)}</span>}
            {multiplayer && hostedCode && (
              <span className="new-room-error">
                You host room {hostedCode} already. Delete it to create a new one.
              </span>
            )}
          </fieldset>
        )}
        <Switch
          variant="comic"
          checked={random}
          onChange={setRandom}
          label="Random map"
          hint={random ? 'Turn off to pick the map yourself' : 'Browse the maps on the left'}
          title={
            multiplayer
              ? 'On: the server picks the map when the second player joins. Off: choose the map on the left.'
              : 'On: the app picks the map when it creates the room. Off: choose the map on the left.'
          }
        />
        {multiplayer ? (
          <RosterField
            label="Your roster"
            text={text.host}
            parsed={parsed.host}
            onChange={(value) => handleTextChange('host', value)}
          />
        ) : (
          <div className="new-room-rosters" role="group" aria-labelledby="new-room-rosters">
            <div className="new-room-rosters-title" id="new-room-rosters">
              Rosters
            </div>
            {TEAMS.map((team) => (
              <RosterField
                key={team}
                label={`${COLOR_NAME[START_COLORS[team]]} roster`}
                color={START_COLORS[team]}
                plate={COLOR_NAME[START_COLORS[team]]}
                text={text[team]}
                parsed={parsed[team]}
                optional={team !== 'host'}
                onChange={(value) => handleTextChange(team, value)}
              />
            ))}
          </div>
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
        <div className="new-room-footer">
          <div className="new-room-foot-note">{footNote}</div>
          <div className="new-room-actions">
            <button type="button" className="new-room-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="comic-go new-room-create pop"
              disabled={!canCreate}
              title={createTitle}
            >
              Create room!
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
