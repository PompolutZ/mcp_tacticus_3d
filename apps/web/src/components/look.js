import { useSyncExternalStore } from 'react'

// The look of cards and tokens: tone mapping ('aces' | 'neutral' | 'agx') and surface of the faces
// ('standard' | 'matte' | 'unlit'). See FaceMaterial.jsx. A module store, because React context does
// not cross the <Canvas> boundary (R3F v8). Debug mode sets it, see App.jsx and DebugPanel.jsx.
export const DEFAULT_LOOK = { toneMapping: 'aces', surface: 'standard' }

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
