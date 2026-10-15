import { useSyncExternalStore } from 'react'

// The look of cards and tokens: tone mapping ('aces' | 'neutral' | 'agx') and surface of the faces
// ('standard' | 'matte' | 'unlit'). See FaceMaterial.jsx. A module store, because React context does
// not cross the <Canvas> boundary (R3F v8). The default is Neutral and Unlit (the choice in
// docs/plans/playtest/playtest-1-bugs.md). Debug mode can switch every option, to compare the look again,
// see debug/useDebugLook.js and DebugPanel.jsx.
export const DEFAULT_LOOK = { toneMapping: 'neutral', surface: 'unlit' }

let look = DEFAULT_LOOK
const listeners = new Set()

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return look
}

export function setLook(next) {
  if (next.toneMapping === look.toneMapping && next.surface === look.surface) return
  look = { toneMapping: next.toneMapping, surface: next.surface }
  listeners.forEach((l) => l())
}

export function useLook() {
  return useSyncExternalStore(subscribe, getSnapshot)
}

// TEMPORARY, until the tray look is chosen: tuning of the dice tray material (DiceTrayParts.jsx), set by
// the Debug panel. lift: the texture black becomes this grey before the tint. The defaults are the normal look.
export const DEFAULT_TRAY_LOOK = { lift: 0, roughness: 0.8, metalness: 0 }

let trayLook = DEFAULT_TRAY_LOOK
const trayListeners = new Set()

function subscribeTray(listener) {
  trayListeners.add(listener)
  return () => trayListeners.delete(listener)
}

export function setTrayLook(next) {
  if (
    next.lift === trayLook.lift &&
    next.roughness === trayLook.roughness &&
    next.metalness === trayLook.metalness
  )
    return
  trayLook = { lift: next.lift, roughness: next.roughness, metalness: next.metalness }
  trayListeners.forEach((l) => l())
}

export function useTrayLook() {
  return useSyncExternalStore(subscribeTray, () => trayLook)
}
