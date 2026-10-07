import { useEffect, useMemo, useRef, useState } from 'react'
import { assetUrl } from '../assets/index.js'
import { MAPS } from '../terrain/maps.js'
import { MAP_CARD_BACK, mapCard } from '../terrain/files.js'
import { formatMctCode, isEmptyRoster } from '../rosters/mct.js'
import { missingFiles, parseRosterText, unknownCodesMessage } from '../rosters/cards.js'
import { createRoom } from '../rooms/store.js'
import { CARD_STEP_KEYS, isEditing } from '../keyboard.js'
import { Carousel } from './Carousel.jsx'
import { Overlay } from './Overlay.jsx'

const MAP_IDS = Object.keys(MAPS)

// "1 character", "10 characters"
const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// What a roster text has, for example "10 characters · 10 tactic cards · 5 Secure · 5 Extract"
function rosterSummary(parsed) {
  return [
    count(parsed.characters.length, 'character'),
    count(parsed.tactics.length, 'tactic card'),
    `${parsed.secure.length} Secure`,
    `${parsed.extract.length} Extract`,
  ].join(' · ')
}

// The warning box for the roster cards that the app has no files for (missingFiles in rosters/cards.js),
// or null when it has all of them. Only characters and Team Tactic cards.
function MissingFiles({ parsed }) {
  const { models, tactics } = useMemo(() => missingFiles(parsed), [parsed])
  if (models.length === 0 && tactics.length === 0) return null
  return (
    <div className="new-room-missing">
      <span className="new-room-missing-title">The app does not have these cards, so they will not show</span>
      {models.length > 0 && <span>No 3D model for {count(models.length, 'character')}: {models.join(', ')}</span>}
      {tactics.length > 0 && <span>No image for {count(tactics.length, 'tactic card')}: {tactics.join(', ')}</span>}
    </div>
  )
}

// The dialog that creates a room (docs/feature-rooms.md, "New room"): the map and the Blue roster. With
// Random map on, the card back shows and the map is picked at creation. With it off, the map card in the
// middle of the carousel is the map. Create room saves the room and calls onCreate(room).
// Escape, Cancel, × or a click on the backdrop calls onClose(). The left and right arrows move the
// carousel, the same as in the roster popup, but not while the roster field has the focus.
export function NewRoomDialog({ onCreate, onClose }) {
  const [random, setRandom] = useState(true)
  const [mapIndex, setMapIndex] = useState(0)
  const [text, setText] = useState('')
  // The browser did not store the room
  const [failed, setFailed] = useState(false)
  const parsed = useMemo(() => parseRosterText(text), [text])
  const empty = isEmptyRoster(parsed)
  // A carousel drag can end on the backdrop. The click then goes to the backdrop. So the backdrop
  // closes the dialog only when the press also started on the backdrop, the same as in RosterPopup.jsx.
  const pressedBackdrop = useRef(false)

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
      else if (!random && CARD_STEP_KEYS[e.code] && !isEditing(e.target)) {
        setMapIndex(i => (i + CARD_STEP_KEYS[e.code] + MAP_IDS.length) % MAP_IDS.length)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [random, onClose])

  function handleCreate(e) {
    e.preventDefault()
    if (empty) return
    const mapId = random ? MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)] : MAP_IDS[mapIndex]
    const room = createRoom(mapId, formatMctCode(parsed))
    if (room) onCreate(room)
    else setFailed(true)
  }

  let status = null
  if (failed) status = <span className="new-room-error">The browser did not store the room. Its storage is full or turned off.</span>
  else if (text.trim() && empty) status = <span className="new-room-error">No known MCT code in the text</span>
  else if (!empty) {
    status = (
      <>
        <span>{rosterSummary(parsed)}</span>
        {parsed.unknown.length > 0 && <span className="new-room-warning">{unknownCodesMessage(parsed.unknown)}</span>}
        <MissingFiles parsed={parsed} />
      </>
    )
  }

  return (
    <Overlay
      className="new-room-backdrop"
      onPointerDown={e => { pressedBackdrop.current = e.target === e.currentTarget }}
      onClick={e => { if (pressedBackdrop.current && e.target === e.currentTarget) onClose() }}
    >
      <button type="button" className="popup-close" aria-label="Close" onClick={onClose}>×</button>
      <form className="new-room" role="dialog" aria-modal="true" aria-label="New room" onSubmit={handleCreate}>
        <h2 className="new-room-title">New room</h2>
        <button
          type="button"
          className={random ? 'chip chip--active' : 'chip'}
          aria-pressed={random}
          title="On: the app picks the map when it creates the room. Off: choose the map below."
          onClick={() => setRandom(v => !v)}
        >
          Random map
        </button>
        {random ? (
          <div className="new-room-random">
            <img className="new-room-card" src={assetUrl(MAP_CARD_BACK)} alt="Random map" draggable={false} />
            <span className="new-room-hint">The app picks the map when it creates the room</span>
          </div>
        ) : (
          <Carousel
            count={MAP_IDS.length}
            index={mapIndex}
            onIndexChange={setMapIndex}
            itemName="Map"
            renderSlide={i => (
              <img className="carousel-card new-room-card" src={assetUrl(mapCard(MAP_IDS[i]))} alt={MAPS[MAP_IDS[i]].name} draggable={false} />
            )}
          />
        )}
        <label className="new-room-roster">
          <span className="group-label">Blue roster</span>
          <input
            type="text"
            className="chip chip--player-blue chip--text new-room-input"
            placeholder="Paste an MCT code"
            value={text}
            onChange={e => { setText(e.target.value); setFailed(false) }}
            autoFocus
          />
        </label>
        <div className="new-room-status" aria-live="polite">{status}</div>
        <div className="new-room-actions">
          <button type="button" className="chip" onClick={onClose}>Cancel</button>
          <button type="submit" className="chip chip--active" disabled={empty}>Create room</button>
        </div>
      </form>
    </Overlay>
  )
}
