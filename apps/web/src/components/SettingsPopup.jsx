import { Dialog } from './Dialog.jsx'
import {
  MAX_SPECTATOR_SIZE,
  MAX_TURN_STEP,
  MIN_SPECTATOR_SIZE,
  MIN_TURN_STEP,
  PLACES,
} from '../settings/settings.js'
import { MOUSE_ROWS } from '../settings/controls.js'
import { KeyBindings } from './KeyBindings.jsx'

// What the first section chooses, in the order of the popup (docs/features/table-tools.md, "Settings menu")
const ITEMS = [
  { item: 'rack', label: 'Range and movement tools' },
  { item: 'power', label: 'Automatic Power Phase' },
  { item: 'cleanup', label: 'Cleanup Phase' },
  { item: 'deployLock', label: 'Deploy Lock' },
  { item: 'matTurn', label: 'Mat turn (Sandbox and single player rooms)' },
]
const PLACE_LABELS = { table: 'Table', hud: 'HUD' }

function ControlsTable({ title, rows }) {
  return (
    <section className="settings-section">
      <h3>{title}</h3>
      <table className="settings-controls">
        <tbody>
          {rows.map((row) => (
            <tr key={row.keys}>
              <th scope="row">{row.keys}</th>
              <td>{row.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

// The Settings popup. settings: { tools: { rack, power, ... }, sound: { volume } } (settings/settings.js). bindings: the key
// bindings in use. onSettingsChange(patch) applies a choice at once, for example { sound: { volume } }; App stores it. A click on
// the backdrop, × or Escape calls onClose() (Dialog.jsx).
export function SettingsPopup({
  settings,
  bindings,
  onSettingsChange,
  debug,
  onDebugClick,
  showLabels,
  onLabelsClick,
  onClose,
}) {
  return (
    <Dialog
      backdropClassName="card-popup roster-popup-backdrop"
      className="settings-popup"
      label="Settings"
      onClose={onClose}
    >
      <h2>Settings</h2>
      <section className="settings-section">
        <h3>On the table or in the HUD</h3>
        {ITEMS.map(({ item, label }) => (
          <div key={item} className="settings-row">
            <span>{label}</span>
            <span className="settings-choice">
              {PLACES.map((place) => (
                <button
                  key={place}
                  type="button"
                  className={`chip${settings.tools[item] === place ? ' chip--active' : ''}`}
                  aria-pressed={settings.tools[item] === place}
                  onClick={() => onSettingsChange({ tools: { ...settings.tools, [item]: place } })}
                >
                  {PLACE_LABELS[place]}
                </button>
              ))}
            </span>
          </div>
        ))}
      </section>
      <section className="settings-section">
        <h3>Sound</h3>
        <label className="settings-row">
          <span>Volume (0 is off)</span>
          <span className="settings-choice">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={settings.sound.volume}
              aria-label="Sound volume"
              onChange={(e) => onSettingsChange({ sound: { volume: Number(e.target.value) } })}
            />
            <span className="settings-volume">{settings.sound.volume}</span>
          </span>
        </label>
      </section>
      <section className="settings-section">
        <h3>Spectator</h3>
        <label className="settings-row">
          <span>Spectator columns size (%)</span>
          <span className="settings-choice">
            <input
              type="range"
              min={MIN_SPECTATOR_SIZE}
              max={MAX_SPECTATOR_SIZE}
              step="5"
              value={settings.spectator.size}
              aria-label="Spectator columns size"
              onChange={(e) => onSettingsChange({ spectator: { size: Number(e.target.value) } })}
            />
            <span className="settings-volume">{settings.spectator.size}</span>
          </span>
        </label>
      </section>
      <section className="settings-section">
        <h3>Debug</h3>
        {/* Mode only in the dev server (App passes the handlers either way) */}
        {import.meta.env.DEV && (
          <div className="settings-row">
            <span>Debug mode: frame numbers, render switch and collider lines</span>
            <span className="settings-choice">
              <button
                type="button"
                className={`chip${debug ? ' chip--active' : ''}`}
                aria-pressed={!!debug}
                onClick={onDebugClick}
              >
                Mode
              </button>
            </span>
          </div>
        )}
        <div className="settings-row">
          <span>Piece name and game Size above each terrain piece</span>
          <span className="settings-choice">
            <button
              type="button"
              className={`chip${showLabels ? ' chip--active' : ''}`}
              aria-pressed={!!showLabels}
              onClick={onLabelsClick}
            >
              Labels
            </button>
          </span>
        </div>
      </section>
      <section className="settings-section">
        <h3>Turn</h3>
        <label className="settings-row">
          <span>Turn step of Q / E and the wheel (°)</span>
          <span className="settings-choice">
            <input
              type="range"
              min={MIN_TURN_STEP}
              max={MAX_TURN_STEP}
              step="1"
              value={settings.turn.step}
              aria-label="Turn step"
              onChange={(e) => onSettingsChange({ turn: { step: Number(e.target.value) } })}
            />
            <span className="settings-volume">{settings.turn.step}°</span>
          </span>
        </label>
      </section>
      <KeyBindings
        bindings={bindings}
        onChange={(changed) => onSettingsChange({ bindings: changed })}
      />
      <ControlsTable title="Mouse" rows={MOUSE_ROWS} />
    </Dialog>
  )
}
