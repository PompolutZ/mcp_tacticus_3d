import { useState } from 'react'
import { MAPS } from '../terrain/maps.js'
import { cardsOfType } from '../crisis/cards.js'

const RANGES = [1, 2, 3, 4, 5]
const MOVES = [
  { label: 'S', type: 'short' },
  { label: 'M', type: 'medium' },
  { label: 'L', type: 'long' },
]
const TEAMS = [
  { team: 'blue', label: 'Blue' },
  { team: 'red', label: 'Red' },
]
const CRISIS_TYPES = [
  { type: 'secure', label: 'Secure' },
  { type: 'extract', label: 'Extract' },
]

// roomCode: the code of the room, or null in the Sandbox. A room has a fixed map and the Blue roster of
// the room, so the toolbar has no map picker and only the Red roster field there. The Red field loads,
// replaces or removes the Red roster of the room (docs/feature-rooms.md).
// onLobby(): the ← Lobby button.
export function Toolbar({
  roomCode,
  onLobby,
  mapId,
  onMapChange,
  activeRange,
  activeMove,
  angleOn,
  onRangeClick,
  onMoveClick,
  onAngleClick,
  debug,
  onDebugClick,
  showLabels,
  onLabelsClick,
  spectator,
  onSpectatorClick,
  onTurnMat,
  deployLine,
  onDeployLineClick,
  crisis,
  onCrisisChange,
  onRosterLoad,
  onRosterRemove,
  libraryOpen,
  onLibraryClick,
}) {
  // The typed text stays in the field after Enter (x clears it)
  const [rosterText, setRosterText] = useState({ blue: '', red: '' })
  const rosterTeams = roomCode ? TEAMS.filter(({ team }) => team === 'red') : TEAMS
  return (
    <div className="toolbar">
      <div className="group">
        <button type="button" className="chip" title="Back to the lobby" onClick={onLobby}>
          ← Lobby
        </button>
        <span
          className="group-label toolbar-room"
          title={roomCode ? 'Room code' : 'Nothing on this table is saved'}
        >
          {roomCode ?? 'Sandbox'}
        </span>
      </div>
      <div className="group">
        <button
          type="button"
          className={`chip${libraryOpen ? ' chip--active' : ''}`}
          title="Characters, Team Tactic cards and tokens to bring to the table"
          onClick={onLibraryClick}
        >
          Library
        </button>
      </div>
      <div className="group">
        <span className="group-label">Mat</span>
        {!roomCode && (
          <select
            className="chip"
            title="Map"
            value={mapId}
            onChange={(e) => onMapChange(e.target.value)}
          >
            {Object.entries(MAPS).map(([id, map]) => (
              <option key={id} value={id}>
                {map.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="chip"
          title="Turn mat 90° counter-clockwise"
          onClick={() => onTurnMat(1)}
        >
          ↺
        </button>
        <button
          type="button"
          className="chip"
          title="Turn mat 90° clockwise"
          onClick={() => onTurnMat(-1)}
        >
          ↻
        </button>
      </div>
      <div className="group">
        <span className="group-label">Range</span>
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            className={`chip${activeRange === r ? ' chip--active' : ''}`}
            onClick={() => onRangeClick(r)}
          >
            R{r}
          </button>
        ))}
      </div>
      <div className="group">
        <span className="group-label">Move</span>
        {MOVES.map((m) => (
          <button
            key={m.type}
            type="button"
            className={`chip${activeMove === m.type ? ' chip--active' : ''}`}
            onClick={() => onMoveClick(m.type)}
          >
            {m.label}
          </button>
        ))}
        <button
          type="button"
          className={`chip${angleOn ? ' chip--active' : ''}`}
          title="Toward / Away: L tool bent 90° (key 6)"
          onClick={onAngleClick}
        >
          T/A
        </button>
      </div>
      <div className="group">
        <span className="group-label">Crisis</span>
        {CRISIS_TYPES.map(({ type, label }) => (
          <select
            key={type}
            className="chip"
            title={`${label} card`}
            value={crisis[type] ?? ''}
            onChange={(e) => onCrisisChange(type, e.target.value || null)}
          >
            <option value="">None</option>
            {cardsOfType(type).map((card) => (
              <option key={card.key} value={card.key}>
                {card.name} · {card.threat}
              </option>
            ))}
          </select>
        ))}
      </div>
      <div className="group">
        <span className="group-label">Roster</span>
        {rosterTeams.map(({ team, label }) => (
          <span key={team} className="roster-field">
            <input
              type="text"
              className={`chip chip--player-${team} chip--text`}
              placeholder="MCT code"
              title={`${label} roster: paste an MCT code and press Enter`}
              value={rosterText[team]}
              onChange={(e) => setRosterText((prev) => ({ ...prev, [team]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRosterLoad(team, rosterText[team])
              }}
            />
            <button
              type="button"
              className="chip"
              title={`Remove the ${label} roster from the table`}
              onClick={() => {
                setRosterText((prev) => ({ ...prev, [team]: '' }))
                onRosterRemove(team)
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="group">
        <span className="group-label">Deploy</span>
        <button
          type="button"
          className={`chip${deployLine ? ' chip--active' : ''}`}
          title="Lock models to within Range 3 of their deployment edge"
          onClick={onDeployLineClick}
        >
          Lock
        </button>
      </div>
      <div className="group">
        <span className="group-label">View</span>
        <button
          type="button"
          className={`chip${spectator ? ' chip--active' : ''}`}
          title="Spectator view: Damage, Power, tokens and objectives above each model"
          onClick={onSpectatorClick}
        >
          Spectator
        </button>
      </div>
      <div className="group">
        <span className="group-label">Debug</span>
        {/* Only in the dev server, see App */}
        {import.meta.env.DEV && (
          <button
            type="button"
            className={`chip${debug ? ' chip--active' : ''}`}
            title="Debug mode: frame numbers, render switch and collider lines. Only in the dev server."
            onClick={onDebugClick}
          >
            Mode
          </button>
        )}
        <button
          type="button"
          className={`chip${showLabels ? ' chip--active' : ''}`}
          title="Show the piece name and game Size above each terrain piece"
          onClick={onLabelsClick}
        >
          Labels
        </button>
      </div>
    </div>
  )
}
