import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useLatest, useOnMount } from './useLatest.js'

// The canvas cursor while the pointer is over a piece: 'pointer' (pointing hand) when a click selects
// or opens it, 'grab' (open hand) when a drag moves it. null: the piece does not change the cursor.
// Only the nearest piece gets pointerover (its handler stops propagation), so one piece at a time
// sets the cursor. The cleanup also runs on unmount, so a removed piece does not keep its cursor.
export function useHoverCursor(hovered, cursor) {
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    if (!hovered || !cursor) return undefined
    gl.domElement.style.cursor = cursor
    return () => {
      gl.domElement.style.cursor = ''
    }
  }, [hovered, cursor, gl])
}

// Tells onHover(true) while the piece is hovered, and onHover(false) when the hover ends. The cleanup also
// runs on unmount, so a removed piece does not stay hovered. onHover is optional. The effect runs only
// when hovered changes. It calls the newest onHover, so a new callback does not restart the hover.
export function useHoverReport(hovered, onHover) {
  const latest = useLatest(onHover)
  useEffect(() => {
    if (!hovered) return undefined
    const report = (over) => latest.current?.(over)
    report(true)
    return () => report(false)
  }, [hovered, latest])
}

// The same for the Alt peek (useCardPeek.js): onCardHover(image, true) while active, onCardHover(image, false)
// after, with the same image object. makeImage() builds the image when the hover starts. A change of key
// while active restarts it (a card that flips shows the new side). makeImage and onCardHover are the newest
// ones, they do not restart it. onCardHover is optional.
export function useHoverPeek(active, makeImage, onCardHover, key) {
  const latest = useLatest({ makeImage, onCardHover })
  useEffect(() => {
    if (!active) return undefined
    const image = latest.current.makeImage()
    const report = (over) => latest.current.onCardHover?.(image, over)
    report(true)
    return () => report(false)
  }, [active, key, latest])
}

// A removed tool does not stay dragged: tells onDrag(false) on unmount. onDrag is optional.
export function useDragEndOnUnmount(onDrag) {
  const latest = useLatest(onDrag)
  useOnMount(() => () => latest.current?.(false))
}
