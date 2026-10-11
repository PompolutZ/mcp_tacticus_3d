import { useSyncExternalStore } from 'react'

// The look of cards and tokens: tone mapping ('aces' | 'neutral' | 'agx') and surface of the faces
// ('standard' | 'matte' | 'unlit'). See FaceMaterial.jsx. A module store, because React context does
// not cross the <Canvas> boundary (R3F v8). The default is Neutral and Unlit (the choice in
// docs/plans/playtest-1-bugs.md). Debug mode can switch every option, to compare the look again,
// see App.jsx and DebugPanel.jsx.
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
