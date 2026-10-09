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

// Numbers from FrameStats, and the render mode switch
export function DebugPanel({ renderMode, onRenderModeChange }) {
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
      <div className="debug-modes">
        {RENDER_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`chip${renderMode === mode.id ? ' chip--active' : ''}`}
            title={mode.title}
            onClick={() => onRenderModeChange(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  )
}
