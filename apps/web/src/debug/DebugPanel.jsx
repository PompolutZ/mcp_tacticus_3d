import { Fragment, useEffect, useState } from 'react'
import { DEFAULT_LOOK } from '../table/tableStore.js'
import { useFrameStats } from './FrameStats.jsx'
import {
  readRenderCounts,
  readRenderReasons,
  resetRenderCounts,
  setRenderCounting,
} from './renderCount.js'

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

function LightSlider({ label, value, onChange }) {
  return (
    <Row label={label}>
      <input
        type="range"
        min="0"
        max="3"
        step="0.05"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />{' '}
      {value.toFixed(2)}
    </Row>
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

// The reasons of the components that feed useRenderReason (top 15 each)
const REASON_NAMES = ['App', 'Scene']

function readAllReasons() {
  return Object.fromEntries(REASON_NAMES.map((n) => [n, readRenderReasons(n).slice(0, 15)]))
}

// Render counts of useRenderCount. Reads the module counters on its own timer, so the panel
// does not make the counted components render.
function RenderCounts() {
  const [rows, setRows] = useState([])
  const [reasons, setReasons] = useState({})
  useEffect(() => {
    setRenderCounting(true)
    const timer = setInterval(() => {
      setRows(readRenderCounts())
      setReasons(readAllReasons())
    }, 500)
    return () => {
      clearInterval(timer)
      setRenderCounting(false)
    }
  }, [])
  return (
    <div className="debug-stats">
      <span className="debug-label">Renders</span>
      <button
        type="button"
        className="chip"
        title="Set all render counts to 0"
        onClick={() => {
          resetRenderCounts()
          setRows([])
          setReasons({})
        }}
      >
        Reset
      </button>
      {rows.map((row) => (
        <Row key={row.name} label={row.name} title="Commits since Reset, and in the last second">
          {row.total} / {row.lastSecond}
        </Row>
      ))}
      {REASON_NAMES.map((name) => (
        <Fragment key={name}>
          {reasons[name]?.length > 0 && <span className="debug-label">{name} reasons</span>}
          {reasons[name]?.map((row) => (
            <Row
              key={row.reason}
              label={row.reason}
              title={`${name} commits where this value changed`}
            >
              {row.count}
            </Row>
          ))}
        </Fragment>
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
  ambient,
  onAmbientChange,
  corner,
  onCornerChange,
  showColliders,
  onShowCollidersChange,
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
      <div className="debug-modes">
        <button
          type="button"
          className={`chip${showColliders ? ' chip--active' : ''}`}
          title="Draw the physics colliders"
          onClick={() => onShowCollidersChange(!showColliders)}
        >
          Colliders
        </button>
      </div>
      <div className="debug-stats">
        <LightSlider label="Ambient" value={ambient} onChange={onAmbientChange} />
        <LightSlider label="Corner lights" value={corner} onChange={onCornerChange} />
        <button
          type="button"
          className="chip"
          title="Ambient and corner lights back to the defaults"
          onClick={() => {
            onAmbientChange(DEFAULT_LOOK.ambient)
            onCornerChange(DEFAULT_LOOK.corner)
          }}
        >
          Reset
        </button>
      </div>
      <RenderCounts />
    </div>
  )
}
