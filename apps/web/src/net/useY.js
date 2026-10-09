// React hooks that read and write the stores of the table document (net/doc.js). Each returns the state and a
// setter in the form of useState, so the handlers of App keep their code. The setter writes the document at
// once (docs/plans/implement-backend/05-yjs-state.md, decision 7).

import { useCallback, useSyncExternalStore } from 'react'

// list: a list store of the table. Returns [entities, setEntities].
export function useYList(list) {
  return [useSyncExternalStore(list.subscribe, list.getSnapshot), list.set]
}

// record: a record store of the table. Returns [record, setRecord].
export function useYRecord(record) {
  return [useSyncExternalStore(record.subscribe, record.getSnapshot), record.set]
}

// One field of a record store. Returns [value, setValue].
export function useYField(record, key) {
  const value = useSyncExternalStore(record.subscribe, () => record.getSnapshot()[key])
  const setValue = useCallback((next) => record.setField(key, next), [record, key])
  return [value, setValue]
}
