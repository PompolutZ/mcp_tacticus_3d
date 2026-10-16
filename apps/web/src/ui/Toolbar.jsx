import { useEffect, useRef, useState } from 'react'
import { COLOR_NAME } from '../sideColors.js'
import { useSideColors } from '../table/useSideColors.jsx'
import { TEAMS } from '../setup/setup.js'
import { MAPS } from '../terrain/maps/index.js'
import { cardsOfType } from '../crisis/cards.js'
import { CopyLinkButton } from '../rooms/CopyLinkButton.jsx'
import { RoomPlayers } from '../rooms/RoomPlayers.jsx'
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

// roomCode: the code of the room, or null in the Sandbox. A room has a fixed map and the Blue roster of
// the room, so the toolbar has no map picker and only the Red roster field there. The Red field loads,
// replaces or removes the Red roster of the room (docs/features/rooms.md).
// multiplayer: the room is a multiplayer room, which has no Roster group (the rosters are fixed, docs/features/rooms.md, "Room"), no Crisis group and no Mat group (the game setup chooses the crisis cards and the
// board edge). guestSeatFree: the guest seat was free when the room opened, so Copy link shows next
// to the room code (docs/features/rooms.md, "Room"), until the guest is seen. side, players, connection: the seats and the
// connection of the room (RoomPlayers.jsx).
// The buttons call the table actions (table/tableStore.js): onLobby is the ← Lobby button.
export function Toolbar({
  roomCode,
  multiplayer = false,
  guestSeatFree = false,
  side = null,
  players = null,
  connection = null,
  mapId,
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
  return (
    <div className="toolbar">
      <div className="toolbar-left">
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
          {multiplayer && guestSeatFree && !connection?.peer && <CopyLinkButton code={roomCode} />}
        </div>
        {multiplayer && <RoomPlayers side={side} players={players} connection={connection} />}
        {!multiplayer && (
          <div className="setup-chip" ref={setupRef}>
            <button
              type="button"
              className={`chip${setupOpen ? ' chip--active' : ''}`}
              title="Sandbox setup: crisis cards and rosters"
              onClick={onSetupClick}
            >
              Setup
            </button>
            {setupOpen && (
              <div className="toolbar-setup-panel">
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
                  {rosterTeams.map((team) => {
                    const label = COLOR_NAME[colors[team]]
                    return (
                      <span key={team} className="roster-field">
                        <input
                          type="text"
                          className={`chip chip--player-${colors[team]} chip--text`}
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
            {matTurnHud && (
              <>
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
              </>
            )}
          </div>
        )}
        {rackHud && (
          <>
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
          </>
        )}
        {deployHud && (
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
        )}
      </div>
      <div className="group toolbar-right">
        <button
          type="button"
          className={`chip${libraryOpen ? ' chip--active' : ''}`}
          title="Characters, Team Tactic cards and tokens to bring to the table"
          onClick={onLibraryClick}
        >
          Library
        </button>
        <button
          type="button"
          className={`chip${logOpen ? ' chip--active' : ''}`}
          title="The log: dice, setup, phases and Priority"
          onClick={onLogClick}
        >
          Log
        </button>
        <button
          type="button"
          className={`chip${spectator ? ' chip--active' : ''}`}
          title="Spectator view: Damage, Power, tokens and objectives above each model"
          onClick={onSpectatorClick}
        >
          Spectator
        </button>
        <button
          type="button"
          className={`chip${settingsOpen ? ' chip--active' : ''}`}
          title="Where the tools are, the keys and mouse controls, and the table labels"
          onClick={onSettingsClick}
        >
          Settings
        </button>
      </div>
    </div>
  )
}
