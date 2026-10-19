import { useEffect, useRef, useState } from 'react'
import '../rooms/comicBase.js'
import './perf.css'
import { useTableStore } from '../table/TableStoreContext.jsx'
import { isSoftwareRenderer } from '../renderer.js'
import { useFrameStats } from './FrameStats.jsx'
import { browserName, osName } from './browser.js'
import { buildReport } from './report.js'

const COPIED_MS = 1500

const ms = (value) => (value == null ? 'n/a' : `${value.toFixed(1)} ms`)

// The browser and the OS, read once from navigator
function readBrowser() {
  const data = navigator.userAgentData
  return {
    browser: browserName({
      brands: data?.brands,
      brave: 'brave' in navigator,
      userAgent: navigator.userAgent,
    }),
    os: osName({ platform: data?.platform, userAgent: navigator.userAgent }),
  }
}

// The performance stats of the "Show performance stats" setting (docs/features/rendering.md, "Performance
// stats"). Numbers from FrameStats (perf/FrameStats.jsx), which must be mounted in the Canvas. pieces: the
// number of pieces on the table. onClose turns the setting off. Loaded only when the setting is on.
export default function PerfOverlay({ pieces, onClose }) {
  const stats = useFrameStats()
  const gpuName = useTableStore((s) => s.gpuName)
  const composer = useTableStore((s) => s.settings.performance.composer)
  const [where] = useState(readBrowser)
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  function copy() {
    const text = buildReport(stats, {
      ...where,
      gpuName,
      software: isSoftwareRenderer(gpuName),
      composer,
      pieces,
    })
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), COPIED_MS)
      })
      .catch(() => {})
  }

  return (
    <div className="comic perf-overlay" role="status" aria-label="Performance stats">
      {stats ? (
        <div className="perf-rows">
          <span>FPS</span>
          <span>{stats.fps.toFixed(0)}</span>
          <span>Slowest frame</span>
          <span>{ms(stats.worstMs)}</span>
          <span>CPU</span>
          <span>{ms(stats.cpuMs)}</span>
          <span>GPU</span>
          <span>{ms(stats.gpuMs)}</span>
          <span>Canvas</span>
          <span>
            {stats.width}×{stats.height} @{stats.dpr}x
          </span>
        </div>
      ) : (
        <div>Measuring…</div>
      )}
      <div className="perf-actions">
        <button
          type="button"
          className="comic-button comic-button--small"
          disabled={!stats}
          onClick={copy}
        >
          {copied ? 'Copied' : 'Copy report'}
        </button>
        <button type="button" className="comic-button comic-button--small" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
