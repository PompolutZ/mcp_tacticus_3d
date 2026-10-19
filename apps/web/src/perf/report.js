// The text of the performance report that "Copy report" puts on the clipboard (docs/features/rendering.md,
// "Performance stats"). A few lines of `name: value`. Pure, no React.

const NOT_AVAILABLE = 'not available'

const ms = (value) => `${value.toFixed(1)} ms`

// A hint at the display rate from the measured fps. A frame rate that sits at a common refresh rate
// can be the display, or a limit such as Energy Saver (30).
export function refreshHint(fps) {
  const near = (rate) => Math.abs(fps - rate) <= rate * 0.08
  if (near(30)) return 'near 30 (Energy Saver, or a 30 Hz limit)'
  if (near(60)) return 'near 60'
  if (near(120)) return 'near 120'
  return `no common rate (${fps.toFixed(0)})`
}

// stats: the numbers of useFrameStats (perf/FrameStats.jsx). info: { gpuName, software, browser, os,
// composer, pieces }. gpuName is null when the browser does not give it. software: the renderer runs on the CPU.
// composer: the composer setting (outlines on). Faster drawing is the opposite. pieces: characters, terrain and loose tokens.
export function buildReport(stats, info) {
  const lines = [
    ['FPS', stats.fps.toFixed(0)],
    ['Slowest frame', ms(stats.worstMs)],
    ['CPU per frame', ms(stats.cpuMs)],
    ['GPU per frame', stats.gpuMs == null ? NOT_AVAILABLE : ms(stats.gpuMs)],
    ['GPU', info.gpuName ?? NOT_AVAILABLE],
    ['Software renderer', info.software ? 'yes' : 'no'],
    ['Browser', info.browser],
    ['OS', info.os],
    ['Pixel ratio', String(stats.dpr)],
    ['Canvas', `${stats.width}x${stats.height}`],
    ['Screen refresh', refreshHint(stats.fps)],
    ['Faster drawing', info.composer ? 'off' : 'on'],
    ['Pieces on table', String(info.pieces)],
  ]
  return lines.map(([name, value]) => `${name}: ${value}`).join('\n')
}
