import { useEffect, useLayoutEffect, useRef } from 'react'

// A ref that holds the value of the last render, for an effect or a handler that must read the newest value
// without running again when it changes. It is set in a layout effect, so every effect of the same commit
// already sees it. The ref object never changes, so it is safe in a deps list.
export function useLatest(value) {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}

// Runs fn once, after the first render. fn is the one of the first render, so it sees the props of that
// render and never the later ones ("only at spawn").
export function useOnMount(fn) {
  const first = useRef(fn)
  useEffect(() => first.current(), [])
}
