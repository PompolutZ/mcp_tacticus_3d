import { createContext, useContext } from 'react'
import { useStore } from 'zustand'

// The store of the table (tableStore.js). The store object never changes, so the context never renders a reader.
// A reader renders when its selected value changes. React context crosses <Canvas> since R3F v9.
const TableStoreContext = createContext(null)

export function TableStoreProvider({ store, children }) {
  return <TableStoreContext value={store}>{children}</TableStoreContext>
}

// The store object, for getState and setState in handlers. Not exported until a handler needs it (steps 6-8 of
// docs/plans/state-context.md), so fallow finds no unused export.
function useTableApi() {
  const store = useContext(TableStoreContext)
  if (!store) throw new Error('useTableApi needs a TableStoreProvider')
  return store
}

// One value of the store: useTableStore((s) => s.ownership)
export function useTableStore(selector) {
  return useStore(useTableApi(), selector)
}
