import { useSyncExternalStore } from 'react'
import { getSnapshot, subscribe } from './session.js'

// The session state: { status, user }. See session.js.
export function useUser() {
  return useSyncExternalStore(subscribe, getSnapshot)
}
