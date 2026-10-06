import { useEffect, useLayoutEffect, useRef } from 'react'

// Every key the app uses. App.jsx handles all key events (see handleKeyDown there), so that
// the same key can do different things in different app states.

// Toolbar tool buttons: key → range number, and key → movement tool type
export const RANGE_KEYS = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }
export const MOVE_KEYS = { 7: 'short', 8: 'medium', 9: 'long' }
// Toward / Away tool, key 6 as in the mod (its Scripting 6)
export const ANGLE_KEY = '6'
// Removes every tool from the table, as key 0 of the mod (returns every tool to the tray)
export const CLEAR_TOOLS_KEY = '0'
// Over the player's dice tray, the number keys add dice instead of tools: key → count. See addDice
// in DiceTray.jsx.
export const DICE_KEYS = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 0: 10 }
// Camera pan, WASD as in TTS: key code → screen direction [right, up]. Up moves toward the top of the screen.
// Key codes, not key values, so the keys stay in the same place on every keyboard layout.
export const PAN_KEYS = { KeyW: [0, 1], KeyS: [0, -1], KeyA: [-1, 0], KeyD: [1, 0] }
// Camera turn, arrow keys as in TTS: key code → direction the view turns [right, up]
export const TURN_KEYS = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }
// Piece turn, Q / E as in TTS (Rotate Left / Rotate Right): key code → direction. 1 turns the piece
// counter-clockwise seen from above. See turnPiece in Scene.jsx.
export const ROTATE_KEYS = { KeyQ: 1, KeyE: -1 }
// Flip, F as in TTS: flips the crisis token or the character card under the pointer, else the
// selected one. See handleFlipKey in App.jsx.
export const FLIP_KEY = 'KeyF'
// Lift, R as in TTS (Raise): lifts the model under the pointer, or puts it back down. See liftPiece
// in Scene.jsx.
export const LIFT_KEY = 'KeyR'
// Lock, L as in TTS: locks or unlocks the terrain piece under the pointer. See handleLockKey in App.jsx.
export const LOCK_KEY = 'KeyL'
// Camera back to the start view, as in TTS
export const RESET_VIEW_KEY = 'Space'
// Deletes the piece under the pointer, as in TTS: a character token on the table, an unlocked
// terrain piece and others (see handleKeyDown in App.jsx). A Mac keyboard's delete key sends Backspace.
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
