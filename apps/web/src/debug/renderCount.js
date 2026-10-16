import { useLayoutEffect, useRef } from 'react'

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
  reasons.clear()
}

// Why a component committed: component name -> (reason -> count)
const reasons = new Map()

// Reasons of one commit. prev null: the first commit, 'mount'. No changed name: 'parent'
// (the parent rendered and passed nothing new). Pure.
export function changedReasons(prev, next) {
  if (!prev) return ['mount']
  const changed = Object.keys(next).filter((name) => !Object.is(prev[name], next[name]))
  return changed.length > 0 ? changed : ['parent']
}

export function countReasons(name, names) {
  if (!enabled) return
  let byReason = reasons.get(name)
  if (!byReason) reasons.set(name, (byReason = new Map()))
  for (const reason of names) byReason.set(reason, (byReason.get(reason) ?? 0) + 1)
}

// [{ reason, count }] of one component name, most counts first
export function readRenderReasons(name) {
  const byReason = reasons.get(name)
  if (!byReason) return []
  return [...byReason]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
}

// Call in a component, unconditionally. A layout effect without deps runs once per commit,
// so the StrictMode double render in dev counts once. Components of one name add up.
export function useRenderCount(name) {
  useLayoutEffect(() => {
    countRender(name)
  })
}

// Call in a component, unconditionally. values: { name: value } of everything the component can
// render for (props, state, store values). Counts each name whose value changed since the last commit.
export function useRenderReason(name, values) {
  const prev = useRef(null)
  useLayoutEffect(() => {
    countReasons(name, changedReasons(prev.current, values))
    prev.current = values
  })
}
