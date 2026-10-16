import { useState } from 'react'
import { shallow } from 'zustand/shallow'

// The value of the last render when the new one has the same content (one level deep), else the new
// one. For a derived object that is rebuilt when its inputs change but often with equal content, so
// a memo child that gets it as a prop does not render.
export function useShallowStable(value) {
  const [kept, setKept] = useState(value)
  if (kept === value || shallow(kept, value)) return kept
  setKept(value)
  return value
}
