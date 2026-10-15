import { useEffect, useMemo, useState } from 'react'
import { assetUrl, hasAsset } from '../assets/index.js'
import { MAPS } from '../terrain/maps/index.js'
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
import { Dialog } from './Dialog.jsx'
import { Switch } from './Switch.jsx'
import { COLOR_NAME, DEFAULT_SIDE_COLORS as START_COLORS } from '../sideColors.js'
import { TEAMS } from '../setup/setup.js'
import { RosterField } from './RosterField.jsx'

const MAP_IDS = Object.keys(MAPS)

// Why Multiplayer is disabled, by the session status
function unavailableText(status) {
  if (status === 'error') return 'Multiplayer is not available: the server does not answer.'
  if (status === 'loading') return 'Checking your login'
  return DISCORD_ON ? 'Log in with Discord to play multiplayer' : 'Log in to play multiplayer'
}

// The dialog that creates a room (docs/features/rooms.md, "New room"): the map and the rosters of both
// players. With Random map on, the card back shows. Single player: the app picks the map at creation. Multiplayer: the server picks it when the
// guest joins. With it off, the map
// card in the middle of the carousel is the map. Create room needs a Blue roster. The Red roster is
// optional, because the Red field of the toolbar can load it later. Create room saves the room and calls
// onCreate(room). Escape (Dialog.jsx), Cancel, × or a click on the backdrop calls onClose(). The left and right arrows
// move the carousel, the same as in the roster popup, but not while a roster field has the focus.
//
// With login on (docs/features/rooms.md, "New room"): a choice at the top: Single player or Multiplayer. A multiplayer room
// has one roster field, for the own side: the host always sits at +z. Create room builds the start table, posts the room to
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
    function handleKeyDown(e) {
      if (!random && CARD_STEP_KEYS[e.code] && !isEditing(e.target)) {
        setMapIndex((i) => (i + CARD_STEP_KEYS[e.code] + MAP_IDS.length) % MAP_IDS.length)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [random])

  async function handleCreate(e) {
    e.preventDefault()
    if (!canCreate) return
    // Multiplayer and random: the server picks the map when the guest joins, so the table has no map
    const mapId = random ? MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)] : MAP_IDS[mapIndex]
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
          table: startTableBytes(random ? null : mapId, rosters),
        })
        onCreate({ id: created.code })
      } catch (err) {
        setCreateError(`Could not create the room: ${err.message}`)
        setBusy(false)
      }
      return
    }
    const room = createRoom(mapId, { host: roster('host'), guest: roster('guest') })
    if (room) onCreate(room)
    else setFailed(true)
  }

  function handleTextChange(team, value) {
    setText((prev) => ({ ...prev, [team]: value }))
    setFailed(false)
    setCreateError(null)
  }

  return (
    <Dialog
      as="form"
      backdropClassName="new-room-backdrop"
      className="new-room"
      label="New room"
      onClose={onClose}
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
        </div>
      )}
      <Switch
        checked={random}
        onChange={setRandom}
        label="Random map"
        title={
          multiplayer
            ? 'On: the server picks the map when the second player joins. Off: choose the map below.'
            : 'On: the app picks the map when it creates the room. Off: choose the map below.'
        }
      />
      {random ? (
        <div className="new-room-random">
          <img
            className="new-room-card"
            src={assetUrl(MAP_CARD_BACK)}
            alt="Random map"
            draggable={false}
          />
          <span className="new-room-hint">
            {multiplayer
              ? 'The map spawns when the second player joins the room'
              : 'The app picks the map when it creates the room'}
          </span>
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
              src={assetUrl(hasAsset(mapCard(MAP_IDS[i])) ? mapCard(MAP_IDS[i]) : MAP_CARD_BACK)}
              alt={MAPS[MAP_IDS[i]].name}
              draggable={false}
            />
          )}
        />
      )}
      {multiplayer ? (
        <RosterField
          label="Your roster"
          text={text.host}
          parsed={parsed.host}
          onChange={(value) => handleTextChange('host', value)}
        />
      ) : (
        TEAMS.map((team) => (
          <RosterField
            key={team}
            label={`${COLOR_NAME[START_COLORS[team]]} roster`}
            color={START_COLORS[team]}
            text={text[team]}
            parsed={parsed[team]}
            optional={team !== 'host'}
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
    </Dialog>
  )
}
