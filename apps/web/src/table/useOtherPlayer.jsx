import { useSyncExternalStore } from 'react'
import { otherTeam } from '../setup/setup.js'
import { useTableStore } from './TableStoreContext.jsx'

// What the other player claims, drags and looks at, read from the ownership and the presence of the store
// (table/tableStore.js). Each hook returns a primitive where it can, so a piece renders only when its own value
// changes, not on every claim or selection of the other player. Without a room both stay empty.
const noSubscribe = () => () => {}
const NO_KEYS = new Set()
const NO_PRESENCE = { selection: [], tools: [], mark: null, ping: null }

function useOwnership(read) {
  const ownership = useTableStore((s) => s.ownership)
  return useSyncExternalStore(ownership?.subscribe ?? noSubscribe, () => read(ownership))
}

// selector(other): other is { selection, tools, mark, ping } of the other player (net/presence.js). The selector
// must return the same value while the field is the same, as a store selector does.
export function useOtherPresence(selector) {
  const presence = useTableStore((s) => s.presence)
  return useSyncExternalStore(presence?.subscribe ?? noSubscribe, () =>
    selector(presence ? presence.other() : NO_PRESENCE),
  )
}

// The other player claims the piece key: true
export function useRemote(key) {
  return useOwnership((o) => o?.otherOwned().has(key) ?? false)
}

// The Set of every key that the other player claims
export function useOtherOwned() {
  return useOwnership((o) => o?.otherOwned() ?? NO_KEYS)
}

// The piece key of the model that the other player drags now, or null
export function useOtherDragKey() {
  return useOwnership((o) => o?.otherDrag() ?? null)
}

// The other player drags the model with this piece key now: true
export function useOtherDragging(key) {
  return useOwnership((o) => (o?.otherDrag() ?? null) === key)
}

// The new piece that the other player drags now, { key, tokenKey }, or null
export function useOtherSpawn() {
  return useOwnership((o) => o?.otherSpawn() ?? null)
}

// The outline mode of the range mark on a piece, 'inRange' | 'outOfRange' | null. The own mark wins over the other
// player's.
export function useRangeMark(kind, id) {
  const own = useTableStore((s) =>
    s.rangeMark?.kind === kind && s.rangeMark.id === id ? s.rangeMark.mode : null,
  )
  const other = useOtherPresence((p) => (p.mark?.key === `${kind}:${id}` ? p.mark.mode : null))
  return own ?? other
}

// The color of the other player when they have the piece selected, else null
export function useOtherSelected(kind, id) {
  const selected = useOtherPresence((p) => p.selection.includes(`${kind}:${id}`))
  const color = useTableStore((s) => s.sideColors[otherTeam(s.ownSide)])
  return selected ? color : null
}
