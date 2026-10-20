import { Dialog } from '../ui/Dialog.jsx'
import '../rooms/comicBase.js'
import './settings.css'
import {
  MAX_BRIGHTNESS,
  MAX_SPECTATOR_SIZE,
  MAX_TURN_STEP,
  MIN_BRIGHTNESS,
  MIN_SPECTATOR_SIZE,
  MIN_TURN_STEP,
  PLACES,
} from './settings.js'
import { MOUSE_ROWS } from './controls.js'
import { KeyBindings } from './KeyBindings.jsx'

// What the first section chooses, in the order of the popup (docs/features/table-tools.md, "Settings menu")
const ITEMS = [
  { item: 'rack', label: 'Range and movement tools' },
  { item: 'power', label: 'Automatic Power Phase' },
  { item: 'cleanup', label: 'Cleanup Phase' },
  { item: 'deployLock', label: 'Deploy Lock' },
  { item: 'matTurn', label: 'Mat turn (Sandbox and solo rooms)' },
]
const PLACE_LABELS = { table: 'Table', hud: 'HUD' }

// The mouse table: the action on the left, the mouse input as a key cap (no x, no +)
function ControlsTable({ title, rows }) {
  return (
    <section className="settings-section">
      <h3>{title}</h3>
      {rows.map((row) => (
        <div key={row.keys} className="settings-row">
          <span className="settings-text">{row.action}</span>
          <span className="key-cap">{row.keys}</span>
        </div>
      ))}
    </section>
  )
}

// A row with a slider and its value in a small box. text is the visible label.
function SliderRow({ text, title, ariaLabel, value, shown = value, onChange, ...range }) {
  return (
    <label className="settings-row" title={title}>
      <span className="settings-text">{text}</span>
      <span className="settings-choice">
        <input
          type="range"
          step="1"
          value={value}
          aria-label={ariaLabel}
          onChange={(e) => onChange(Number(e.target.value))}
          {...range}
        />
        <span className="settings-value">{shown}</span>
      </span>
    </label>
  )
}

// A row with one on / off button: "<word> on" or "<word> off", yellow when on
function ToggleRow({ text, word, on, onClick }) {
  return (
    <div className="settings-row">
      <span className="settings-text">{text}</span>
      <span className="settings-choice">
        <button type="button" className="settings-btn" aria-pressed={on} onClick={onClick}>
          {word} {on ? 'on' : 'off'}
        </button>
      </span>
    </div>
  )
}

// The Settings popup. settings: { tools: { rack, power, ... }, sound: { volume } } (settings/settings.js). bindings: the key
// bindings in use. onSettingsChange(patch) applies a choice at once, for example { sound: { volume } }; App stores it. A click on
// the backdrop, the yellow x or Escape calls onClose() (Dialog.jsx). The look is in settings.css.
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
      className="comic settings-comic"
      closeClassName="settings-comic-close"
      label="Settings"
      onClose={onClose}
    >
      <header className="settings-head comic-page">
        <h2>Settings</h2>
      </header>
      <div className="settings-body">
        <section className="settings-section">
          <h3>On the table or in the HUD</h3>
          {ITEMS.map(({ item, label }) => (
            <div key={item} className="settings-row">
              <span className="settings-text">{label}</span>
              <span
                className="settings-choice settings-segment"
                role="radiogroup"
                aria-label={label}
              >
                {PLACES.map((place) => (
                  <button
                    key={place}
                    type="button"
                    role="radio"
                    className="settings-btn"
                    aria-checked={settings.tools[item] === place}
                    onClick={() =>
                      onSettingsChange({ tools: { ...settings.tools, [item]: place } })
                    }
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
          <SliderRow
            text="Volume (0 is off)"
            ariaLabel="Sound volume"
            min="0"
            max="100"
            value={settings.sound.volume}
            onChange={(volume) => onSettingsChange({ sound: { volume } })}
          />
        </section>
        <section className="settings-section">
          <h3>Light</h3>
          <SliderRow
            text="Scene brightness (%)"
            title="Lights models, terrain, mat and dice. Cards and tokens are not changed."
            ariaLabel="Scene brightness"
            min={MIN_BRIGHTNESS}
            max={MAX_BRIGHTNESS}
            step="5"
            value={settings.light.brightness}
            shown={`${settings.light.brightness}%`}
            onChange={(brightness) => onSettingsChange({ light: { brightness } })}
          />
          <p className="settings-hint">
            Screens differ. Raise it if the table looks dark on yours. High values can make models
            look washed out.
          </p>
        </section>
        <section className="settings-section">
          <h3>Performance</h3>
          <ToggleRow
            text="Faster drawing (no outlines)"
            word="Faster"
            on={!settings.performance.composer}
            onClick={() =>
              onSettingsChange({
                performance: {
                  ...settings.performance,
                  composer: !settings.performance.composer,
                },
              })
            }
          />
          <p className="settings-hint">
            Turning it on removes the outlines for hover, selection, the other player&apos;s
            selection, range marks, overlap and the tray swap target. A selected piece gets an
            orange shade instead. The hover name label stays. The 3D scene loads again when you
            change this.
          </p>
          <ToggleRow
            text="Show performance stats"
            word="Stats"
            on={settings.performance.stats}
            onClick={() =>
              onSettingsChange({
                performance: { ...settings.performance, stats: !settings.performance.stats },
              })
            }
          />
          <p className="settings-hint">
            The numbers help find why the table is slow. &quot;Copy report&quot; copies them, to
            send to the developer.
          </p>
        </section>
        <section className="settings-section">
          <h3>Streamer</h3>
          <SliderRow
            text="Streamer columns size (%)"
            ariaLabel="Streamer columns size"
            min={MIN_SPECTATOR_SIZE}
            max={MAX_SPECTATOR_SIZE}
            step="5"
            value={settings.spectator.size}
            onChange={(size) => onSettingsChange({ spectator: { size } })}
          />
        </section>
        <section className="settings-section">
          <h3>Debug</h3>
          {/* Mode only in the dev server (App passes the handlers either way) */}
          {import.meta.env.DEV && (
            <ToggleRow
              text="Debug mode: frame numbers, render switch and collider lines"
              word="Mode"
              on={!!debug}
              onClick={onDebugClick}
            />
          )}
          <ToggleRow
            text="Piece name and game Size above each terrain piece"
            word="Labels"
            on={!!showLabels}
            onClick={onLabelsClick}
          />
        </section>
        <section className="settings-section">
          <h3>Dice</h3>
          <ToggleRow
            text="A die that rests tilted is thrown again. Off: it reads the face nearest to up"
            word="Re-throw"
            on={!!settings.rethrowTilted}
            onClick={() => onSettingsChange({ rethrowTilted: !settings.rethrowTilted })}
          />
        </section>
        <section className="settings-section">
          <h3>Camera</h3>
          <ToggleRow
            text="Left drag on the empty table moves the camera. Off: use right or middle drag"
            word="Left drag camera"
            on={settings.leftDragCamera !== false}
            onClick={() => onSettingsChange({ leftDragCamera: settings.leftDragCamera === false })}
          />
          <ToggleRow
            text="Two-finger swipe on a trackpad moves the camera. Off: it zooms, as in TTS"
            word="Trackpad swipe pans"
            on={settings.trackpadSwipePans === true}
            onClick={() =>
              onSettingsChange({ trackpadSwipePans: settings.trackpadSwipePans !== true })
            }
          />
          <ToggleRow
            text="Mouse camera drag and camera keys work at the same time. Off: the first input wins"
            word="Mouse and keys move camera together"
            on={settings.cameraInputsTogether !== false}
            onClick={() =>
              onSettingsChange({ cameraInputsTogether: settings.cameraInputsTogether === false })
            }
          />
        </section>
        <section className="settings-section">
          <h3>Turn</h3>
          <SliderRow
            text="Turn step of Q / E and the wheel (°)"
            ariaLabel="Turn step"
            min={MIN_TURN_STEP}
            max={MAX_TURN_STEP}
            value={settings.turn.step}
            shown={`${settings.turn.step}°`}
            onChange={(step) => onSettingsChange({ turn: { step } })}
          />
        </section>
        <KeyBindings
          bindings={bindings}
          onChange={(changed) => onSettingsChange({ bindings: changed })}
        />
        <ControlsTable title="Mouse" rows={MOUSE_ROWS} />
      </div>
    </Dialog>
  )
}
