import { COLOR_NAME } from '../sideColors.js'
import { useTableStore } from './TableStoreContext.jsx'

// The color of each side, { host, guest } → 'blue' | 'red' (sideColors.js), from the store of the table. App writes it.
export function useSideColors() {
  return useTableStore((s) => s.sideColors)
}

// The color 'blue' | 'red' of `side`, or undefined for something that is not a side
export function useSideColor(side) {
  return useTableStore((s) => s.sideColors[side])
}

// The name 'Blue' | 'Red' of the color of `side`
export function useSideName(side) {
  const color = useSideColor(side)
  return color ? COLOR_NAME[color] : undefined
}
