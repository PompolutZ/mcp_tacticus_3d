import { useRef } from 'react'
import { Overlay } from './Overlay.jsx'
import { KEY_ROWS, MOUSE_ROWS } from '../settings/controls.js'

// What the first section chooses, in the order of the popup (docs/features/table-tools.md, "Settings menu")
const ITEMS = [
  { item: 'rack', label: 'Range and movement tools' },
  { item: 'power', label: 'Automatic Power Phase' },
  { item: 'cleanup', label: 'Cleanup Phase' },
  { item: 'deployLock', label: 'Deploy Lock' },
  { item: 'matTurn', label: 'Mat turn (Sandbox and single player rooms)' },
]
const PLACES = [
  { place: 'table', label: 'Table' },
  { place: 'hud', label: 'HUD' },
]

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

// The Settings popup. settings: { tools: { rack, power, ... }, sound: { volume } } (settings/settings.js).
// onChange(item, place) and onVolumeChange(volume) apply a choice at once; App stores it. App closes the popup on Escape, as App handles all keys. A click on
// the backdrop or × calls onClose().
export function SettingsPopup({ settings, onChange, onVolumeChange, onClose }) {
  // A drag that ends on the backdrop (a text selection, a scroll bar) must not close the popup
  const pressedBackdrop = useRef(false)
  return (
    <Overlay
      className="card-popup roster-popup-backdrop"
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
      <div className="settings-popup" role="dialog" aria-modal="true" aria-label="Settings">
        <h2>Settings</h2>
        <section className="settings-section">
          <h3>On the table or in the HUD</h3>
          {ITEMS.map(({ item, label }) => (
            <div key={item} className="settings-row">
              <span>{label}</span>
              <span className="settings-choice">
                {PLACES.map(({ place, label: placeLabel }) => (
                  <button
                    key={place}
                    type="button"
                    className={`chip${settings.tools[item] === place ? ' chip--active' : ''}`}
                    aria-pressed={settings.tools[item] === place}
                    onClick={() => onChange(item, place)}
                  >
                    {placeLabel}
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
                onChange={(e) => onVolumeChange(Number(e.target.value))}
              />
              <span className="settings-volume">{settings.sound.volume}</span>
            </span>
          </label>
        </section>
        <ControlsTable title="Keys" rows={KEY_ROWS} />
        <ControlsTable title="Mouse" rows={MOUSE_ROWS} />
      </div>
    </Overlay>
  )
}
