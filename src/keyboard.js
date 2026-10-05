import { useEffect, useLayoutEffect, useRef } from 'react'

// Every key the app uses. App.jsx handles all key events (see handleKeyDown there), so that
// the same key can do different things in different app states.

// Toolbar tool buttons: key → range number, and key → movement tool type
export const RANGE_KEYS = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }
export const MOVE_KEYS = { 7: 'short', 8: 'medium', 9: 'long' }
// Camera pan, WASD as in TTS: key code → screen direction [right, up]. Up moves toward the top of the screen.
// Key codes, not key values, so the keys stay in the same place on every keyboard layout.
export const PAN_KEYS = { KeyW: [0, 1], KeyS: [0, -1], KeyA: [-1, 0], KeyD: [1, 0] }
// Camera turn, arrow keys as in TTS: key code → direction the view turns [right, up]
export const TURN_KEYS = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }
// Piece turn, Q / E as in TTS (Rotate Left / Rotate Right): key code → direction. 1 turns the piece
// counter-clockwise seen from above. See turnPiece in Scene.jsx.
export const ROTATE_KEYS = { KeyQ: 1, KeyE: -1 }
// Camera back to the start view, as in TTS
export const RESET_VIEW_KEY = 'Space'
// Deletes the character token on the table under the pointer, as in TTS. A Mac keyboard's delete
// key sends Backspace.
export const DELETE_KEYS = ['Delete', 'Backspace']

// Keys in a text field or a select edit it (letters type, arrow keys move the cursor or the option), so the app does not use them
export function isEditing(target) {
  return Boolean(target.closest?.('input, textarea, select, [contenteditable]'))
}

// Sends every keydown and keyup on the window, and the window blur, to the handlers of the last
// render, so the handlers read the current app state. The listeners are added once.
export function useWindowKeys(onKeyDown, onKeyUp, onBlur) {
  const handlers = useRef(null)
  useLayoutEffect(() => {
    handlers.current = { onKeyDown, onKeyUp, onBlur }
  })
  useEffect(() => {
    const down = e => handlers.current.onKeyDown(e)
    const up = e => handlers.current.onKeyUp(e)
    const blur = () => handlers.current.onBlur()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])
}
