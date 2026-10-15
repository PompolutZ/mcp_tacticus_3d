import { useFrameStats } from './FrameStats.jsx'

// Parts of the rendering that can be turned off, to measure their cost. See SelectionOutlines.
const RENDER_MODES = [
  { id: 'full', label: 'Full', title: 'Composer with outlines, as in the normal app' },
  { id: 'no-outline', label: 'No outline', title: 'Composer without outlines' },
  {
    id: 'no-composer',
    label: 'No composer',
    title: 'The scene drawn straight to the screen: no outlines and no antialiasing',
  },
]

// Look options of cards and tokens, temporary until the look is chosen (docs/plans/playtest/playtest-1-bugs.md)
const TONE_MAPPINGS = [
  { id: 'aces', label: 'ACES Filmic', title: 'As in the normal app' },
  { id: 'neutral', label: 'Neutral', title: 'Khronos PBR Neutral: shows base colors as they are' },
  { id: 'agx', label: 'AgX', title: 'AgX: soft highlights, lower contrast' },
]
const SURFACES = [
  { id: 'standard', label: 'Standard', title: 'As in the normal app: reflects some light' },
  { id: 'matte', label: 'Matte', title: 'No reflection. The rest of the light stays.' },
  {
    id: 'unlit',
    label: 'Unlit',
    title: 'Exact image colors, no light and no shadow. Skips tone mapping only in No composer.',
  },
]

function ms(value) {
  return value === null ? 'n/a' : `${value.toFixed(1)} ms`
}

function count(value) {
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)} M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)} k`
  return String(value)
}

function Row({ label, title, children }) {
  return (
    <>
      <span className="debug-label" title={title}>
        {label}
      </span>
      <span>{children}</span>
    </>
  )
}

// TEMPORARY until the tray look is chosen (components/look.js, DiceTrayParts.jsx)
const TRAY_SLIDERS = [
  {
    id: 'lift',
    label: 'Black lift',
    max: 0.6,
    title: 'Texture black becomes this grey before the tint',
  },
  { id: 'roughness', label: 'Roughness', max: 1, title: 'Tray material roughness' },
  { id: 'metalness', label: 'Metalness', max: 1, title: 'Tray material metalness' },
]

function TraySection({ tray, onChange, onReset }) {
  return (
    <div className="debug-stats">
      <span className="debug-label">Dice tray</span>
      <button type="button" className="chip" onClick={onReset}>
        Reset
      </button>
      {TRAY_SLIDERS.map((s) => (
        <Row key={s.id} label={s.label} title={s.title}>
          <input
            type="range"
            min={0}
            max={s.max}
            step={0.01}
            value={tray[s.id]}
            aria-label={`Tray ${s.label}`}
            onChange={(e) => onChange({ [s.id]: Number(e.target.value) })}
          />{' '}
          {tray[s.id].toFixed(2)}
        </Row>
      ))}
    </div>
  )
}

function ModeButtons({ options, value, onChange }) {
  return (
    <div className="debug-modes">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`chip${value === option.id ? ' chip--active' : ''}`}
          title={option.title}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// Numbers from FrameStats, the render mode switch and the look switches
export function DebugPanel({
  renderMode,
  onRenderModeChange,
  toneMapping,
  onToneMappingChange,
  surface,
  onSurfaceChange,
  tray,
  onTrayChange,
  onTrayReset,
}) {
  const stats = useFrameStats()
  return (
    <div className="debug-panel">
      {stats ? (
        <div className="debug-stats">
          <Row label="FPS" title="Frames per second. The display refresh rate is the upper limit.">
            {stats.fps.toFixed(0)}
          </Row>
          <Row
            label="Worst"
            title="Longest time between two frames in the period. A stutter shows here even when FPS looks fine."
          >
            {ms(stats.worstMs)}
          </Row>
          <Row
            label="CPU"
            title="JavaScript time of a frame: physics, useFrame callbacks and sending the draw calls. Pointer events are not included."
          >
            {ms(stats.cpuMs)}
          </Row>
          <Row
            label="GPU"
            title="GPU time of a frame. n/a when the browser cannot measure it (Safari, Firefox)."
          >
            {ms(stats.gpuMs)}
          </Row>
          <Row
            label="Draw calls"
            title="Draw calls in the last frame, of all renders: shadow map, scene, outline passes"
          >
            {stats.calls}
          </Row>
          <Row label="Triangles" title="Triangles drawn in the last frame, of all renders">
            {count(stats.triangles)}
          </Row>
          <Row label="Canvas" title="Size of the drawing buffer in device pixels">
            {stats.width}×{stats.height} @{stats.dpr}x
          </Row>
        </div>
      ) : (
        <div className="debug-label">Measuring…</div>
      )}
      <ModeButtons options={RENDER_MODES} value={renderMode} onChange={onRenderModeChange} />
      <ModeButtons options={TONE_MAPPINGS} value={toneMapping} onChange={onToneMappingChange} />
      <ModeButtons options={SURFACES} value={surface} onChange={onSurfaceChange} />
      <TraySection tray={tray} onChange={onTrayChange} onReset={onTrayReset} />
    </div>
  )
}
