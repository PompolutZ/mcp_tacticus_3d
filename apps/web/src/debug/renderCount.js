import { useLayoutEffect } from 'react'

// Counts commits per component name, for the "Renders" section of DebugPanel.
// Plain module objects, no React state and no subscription: counting renders nothing.
const WINDOW_MS = 1000
let enabled = false
const totals = new Map()
// Commit times of the last second, per name
const recent = new Map()

// DebugPanel turns counting on while it is mounted, so it counts only while debug is on
export function setRenderCounting(on) {
  enabled = on
}

export function countRender(name, now = performance.now()) {
  if (!enabled) return
  totals.set(name, (totals.get(name) ?? 0) + 1)
  const times = recent.get(name)
  if (times) times.push(now)
  else recent.set(name, [now])
}

// [{ name, total, lastSecond }], sorted by name
export function readRenderCounts(now = performance.now()) {
  return [...totals.keys()].sort().map((name) => {
    const times = recent.get(name)
    while (times.length > 0 && times[0] <= now - WINDOW_MS) times.shift()
    return { name, total: totals.get(name), lastSecond: times.length }
  })
}

export function resetRenderCounts() {
  totals.clear()
  recent.clear()
}

// Call in a component, unconditionally. A layout effect without deps runs once per commit,
// so the StrictMode double render in dev counts once. Components of one name add up.
export function useRenderCount(name) {
  useLayoutEffect(() => {
    countRender(name)
  })
}
