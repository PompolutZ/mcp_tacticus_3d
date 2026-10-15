import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

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
// when hovered changes, so the callback of that render is the one that gets the false.
export function useHoverReport(hovered, onHover) {
  useEffect(() => {
    if (!hovered) return undefined
    onHover?.(true)
    return () => onHover?.(false)
  }, [hovered])
}

// A removed tool does not stay dragged: tells onDrag(false) on unmount. onDrag is optional.
export function useDragEndOnUnmount(onDrag) {
  useEffect(() => () => onDrag?.(false), [])
}
