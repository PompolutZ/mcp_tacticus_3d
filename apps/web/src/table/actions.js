import { useSyncExternalStore } from 'react'

// The actions that components call to change the table, by feature: { setup }. App sets them every render,
// and a component reads them with useTableActions. React context does not cross the <Canvas> boundary, so
// the store is a module, the same as sideColors.js. Before the first set the store is empty.
const NONE = {}
let actions = NONE
const listeners = new Set()

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return actions
}

export function setTableActions(next) {
  actions = next ?? NONE
  listeners.forEach((l) => l())
}

export function useTableActions() {
  return useSyncExternalStore(subscribe, getSnapshot)
}
