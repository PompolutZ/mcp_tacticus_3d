import { memo, useEffect, useRef, useState } from 'react'
import { COLOR_NAME } from '../sideColors.js'
import { useSideColors } from '../table/useSideColors.jsx'
import { TEAMS } from '../setup/setup.js'
import { MAPS } from '../terrain/maps/index.js'
import { SORTED_MATS } from '../terrain/builder.js'
import { CUSTOM_MAP_ID, MAT_PREFIX } from '../rooms/table.js'
import { cardsOfType } from '../crisis/cards.js'
import { CopyLinkButton } from '../rooms/CopyLinkButton.jsx'
import '../rooms/comicBase.js'
import './hud.css'
import { Scoreboard } from './Scoreboard.jsx'
import { useRenderCount } from '../debug/renderCount.js'
import { useTableStore } from '../table/TableStoreContext.jsx'

const RANGES = [1, 2, 3, 4, 5]
const MOVES = [
  { label: 'S', type: 'short' },
  { label: 'M', type: 'medium' },
  { label: 'L', type: 'long' },
]
const CRISIS_TYPES = [
  { type: 'secure', label: 'Secure' },
  { type: 'extract', label: 'Extract' },
]

// mapChoice: the value of the Map select (rooms/table.js, mapChoice). buildOn: Build mode is on.
// roomCode: the code of the room, or null in the Sandbox. A room has a fixed map and the Blue roster of
// the room, so the toolbar has no map picker and only the Red roster field there. The Red field loads,
// replaces or removes the Red roster of the room (docs/features/rooms.md).
// multiplayer: the room is a multiplayer room, which has no Roster group (the rosters are fixed, docs/features/rooms.md, "Room"), no Crisis group and no Mat group (the game setup chooses the crisis cards and the
// board edge). A room always shows the copy link icon next to its code. connection: the connection of the room, and
// scoreMarkers: the score, for the scoreboard at the top center (Scoreboard.jsx).
// Each part has the .comic class on its own root (hud.css), so the HUD parts that keep the old look are not
// touched.
// The buttons call the table actions (table/tableStore.js): onLobby is the ← Lobby button.
function Toolbar({
  roomCode,
  multiplayer = false,
  connection = null,
  scoreMarkers,
  mapChoice,
  buildOn = false,
  activeRange,
  activeMove,
  angleOn,
  settingsOpen,
  deployLine,
  crisis,
  libraryOpen,
  logOpen,
  setupOpen,
}) {
  useRenderCount('Toolbar')
  const {
    onLobby,
    onMapChange,
    onBuildClick,
    onRangeClick,
    onMoveClick,
    onAngleClick,
    onSpectatorClick,
    onTurnMat,
    onSettingsClick,
    onDeployLineClick,
    onCrisisChange,
    onRosterLoad,
    onRosterRemove,
    onLibraryClick,
    onLogClick,
    onSetupClick,
    onSetupClose,
  } = useTableStore((s) => s.actions)
  const spectator = useTableStore((s) => s.spectator)
  const toolPlaces = useTableStore((s) => s.settings.tools)
  // The typed text stays in the field after Enter (x clears it)
  const [rosterText, setRosterText] = useState({ host: '', guest: '' })
  // A setting of 'hud' puts the item in the toolbar, 'table' on the table (docs/features/table-tools.md,
  // "Settings menu"). The Mat group stays for the map select, also when the mat turn is on the table.
  const hud = (item) => toolPlaces[item] === 'hud'
  const rackHud = hud('rack')
  const deployHud = hud('deployLock')
  const matTurnHud = hud('matTurn')
  const showMat = !multiplayer && (matTurnHud || !roomCode)
  const colors = useSideColors()
  // A pointerdown outside the chip and its panel closes the panel (as DieMenu in DiceKeys.jsx)
  const setupRef = useRef(null)
  useEffect(() => {
    if (!setupOpen) return undefined
    function handlePointerDown(e) {
      if (setupRef.current?.contains(e.target)) return
      onSetupClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [setupOpen, onSetupClose])
  const rosterTeams = roomCode ? ['guest'] : TEAMS
  const hudButtons = [
    {
      key: 'library',
      label: 'Library',
      title: 'Characters, Team Tactic cards and tokens to bring to the table',
      open: libraryOpen,
      onClick: onLibraryClick,
    },
    {
      key: 'log',
      label: 'Log',
      title: 'The log: dice, setup, phases and Priority',
      open: logOpen,
      onClick: onLogClick,
    },
    {
      key: 'streamer',
      label: 'Streamer',
      title: 'Streamer view: Damage, Power, tokens and objectives above each model',
      open: spectator,
      onClick: onSpectatorClick,
    },
    {
      key: 'settings',
      label: 'Settings',
      title: 'Where the tools are, the keys and mouse controls, and the table labels',
      open: settingsOpen,
      onClick: onSettingsClick,
    },
  ]
  return (
    <div className="toolbar">
      <Scoreboard scoreMarkers={scoreMarkers} connection={connection} />
      <div className="toolbar-left">
        <div className="comic hud-box hud-left">
          <button type="button" className="hud-lobby" title="Back to the lobby" onClick={onLobby}>
            <svg
              width="18"
              height="18"
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
          <span
            className="hud-room"
            title={roomCode ? 'Room code' : 'Nothing on this table is saved'}
          >
            <span className="hud-room-label">{roomCode ? 'Room' : 'Sandbox'}</span>
            {roomCode && (
              <>
                <span className="hud-room-code">{roomCode}</span>
                <CopyLinkButton code={roomCode} />
              </>
            )}
          </span>
        </div>
        {!multiplayer && (
          <div className="comic hud-box hud-setup" ref={setupRef}>
            <button
              type="button"
              className={`hud-chip hud-chip--big${setupOpen ? ' hud-chip--on' : ''}`}
              aria-expanded={setupOpen}
              title="Sandbox setup: crisis cards and rosters"
              onClick={onSetupClick}
            >
              Setup
            </button>
            {setupOpen && (
              <div className="hud-setup-panel">
                <span className="hud-setup-tag">Prepare for battle</span>
                <div className="hud-setup-field">
                  <span className="hud-setup-label">Crisis</span>
                  <div className="hud-setup-crisis">
                    {CRISIS_TYPES.map(({ type, label }) => (
                      <select
                        key={type}
                        className="hud-select"
                        title={`${label} card`}
                        aria-label={`${label} card`}
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
                </div>
                <div className="hud-setup-field">
                  <span className="hud-setup-label">Roster</span>
                  {rosterTeams.map((team) => {
                    const label = COLOR_NAME[colors[team]]
                    return (
                      <span key={team} className="hud-roster">
                        <span className={`hud-roster-side seat-plate--${colors[team]}`}>
                          {label}
                        </span>
                        <input
                          type="text"
                          className="hud-input"
                          placeholder="MCT code"
                          title={`${label} roster: paste an MCT code and press Enter`}
                          value={rosterText[team]}
                          onChange={(e) =>
                            setRosterText((prev) => ({
                              ...prev,
                              [team]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') onRosterLoad(team, rosterText[team])
                          }}
                        />
                        <button
                          type="button"
                          className="hud-chip hud-chip--big"
                          title={`Remove the ${label} roster from the table`}
                          onClick={() => {
                            setRosterText((prev) => ({ ...prev, [team]: '' }))
                            onRosterRemove(team)
                          }}
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="toolbar-middle">
        {showMat && (
          <div className="comic hud-box hud-group">
            <span className="hud-label">Mat</span>
            {!roomCode && (
              <select
                className="hud-select hud-select--inline"
                title="Map"
                aria-label="Map"
                value={mapChoice}
                onChange={(e) => onMapChange(e.target.value)}
              >
                {mapChoice === '' && <option value="" disabled />}
                {mapChoice === CUSTOM_MAP_ID && (
                  <option value={CUSTOM_MAP_ID} disabled>
                    Custom board
                  </option>
                )}
                <optgroup label="Maps">
                  {Object.entries(MAPS).map(([id, map]) => (
                    <option key={id} value={id}>
                      {map.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Empty mat">
                  {SORTED_MATS.map((m) => (
                    <option key={m.name} value={`${MAT_PREFIX}${m.name}`}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            )}
            {!roomCode && (
              <button
                type="button"
                className={`hud-chip${buildOn ? ' hud-chip--on' : ''}`}
                aria-pressed={buildOn}
                title="Build mode: add, move, turn and remove terrain pieces, export and import a board"
                onClick={onBuildClick}
              >
                Build
              </button>
            )}
            {matTurnHud && (
              <>
                <button
                  type="button"
                  className="hud-chip"
                  title="Turn mat 90° counter-clockwise"
                  onClick={() => onTurnMat(1)}
                >
                  ↺
                </button>
                <button
                  type="button"
                  className="hud-chip"
                  title="Turn mat 90° clockwise"
                  onClick={() => onTurnMat(-1)}
                >
                  ↻
                </button>
              </>
            )}
          </div>
        )}
        {rackHud && (
          <>
            <div className="comic hud-box hud-group">
              <span className="hud-label">Range</span>
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`hud-chip${activeRange === r ? ' hud-chip--on' : ''}`}
                  aria-pressed={activeRange === r}
                  onClick={() => onRangeClick(r)}
                >
                  R{r}
                </button>
              ))}
            </div>
            <div className="comic hud-box hud-group">
              <span className="hud-label">Move</span>
              {MOVES.map((m) => (
                <button
                  key={m.type}
                  type="button"
                  className={`hud-chip${activeMove === m.type ? ' hud-chip--on' : ''}`}
                  aria-pressed={activeMove === m.type}
                  onClick={() => onMoveClick(m.type)}
                >
                  {m.label}
                </button>
              ))}
              <button
                type="button"
                className={`hud-chip${angleOn ? ' hud-chip--on' : ''}`}
                aria-pressed={angleOn}
                title="Toward / Away: L tool bent 90° (key 6)"
                onClick={onAngleClick}
              >
                T/A
              </button>
            </div>
          </>
        )}
        {deployHud && (
          <div className="comic hud-box hud-group">
            <span className="hud-label">Deploy</span>
            <button
              type="button"
              className={`hud-chip${deployLine ? ' hud-chip--on' : ''}`}
              aria-pressed={deployLine}
              title="Lock models to within Range 3 of their deployment edge"
              onClick={onDeployLineClick}
            >
              Lock
            </button>
          </div>
        )}
      </div>
      <div className="comic hud-box hud-right">
        {hudButtons.map(({ key, label, title, open, onClick }) => (
          <button
            key={key}
            type="button"
            className={`hud-toggle${open ? ' hud-toggle--on' : ''}`}
            aria-pressed={open}
            data-hud-button={key}
            title={title}
            onClick={onClick}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

const MemoToolbar = memo(Toolbar)
export { MemoToolbar as Toolbar }
