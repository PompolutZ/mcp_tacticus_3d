import { useSyncExternalStore } from 'react'

// The color of each side, { host: 'blue' | 'red', guest: 'blue' | 'red' }. A side key is a seat (+z or -z), not
// a color. The color comes from colorOf in setup/setup.js (docs/features/setup-game.md, "Colors"). App.jsx
// computes it from the setup and sets it here, so the DOM and the Canvas (React context does not cross the
// <Canvas> boundary, see look.js) read it the same way. The default is the colors before the roll off.
export const DEFAULT_SIDE_COLORS = { blue: 'blue', red: 'red' }
export const COLOR_NAME = { blue: 'Blue', red: 'Red' }
// The hex color of a color, for texts, rings and markers
export const COLOR_HEX = { blue: '#2980b9', red: '#c0392b' }

let colors = DEFAULT_SIDE_COLORS
const listeners = new Set()

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return colors
}

export function setSideColors(next) {
  if (next.host === colors.host && next.guest === colors.guest) return
  colors = { host: next.host, guest: next.guest }
  listeners.forEach((l) => l())
}

export function useSideColors() {
  return useSyncExternalStore(subscribe, getSnapshot)
}

// The color 'blue' | 'red' of `side`, or undefined for something that is not a side
export function useSideColor(side) {
  return useSideColors()[side]
}

// The name 'Blue' | 'Red' of the color of `side`
export function useSideName(side) {
  const color = useSideColor(side)
  return color ? COLOR_NAME[color] : undefined
}
