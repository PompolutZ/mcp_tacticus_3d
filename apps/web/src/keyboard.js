import { useEffect, useLayoutEffect, useRef } from 'react'

// Every key the app uses. keyAction below decides what a key press does, so that the same key can do
// different things in different app states. useTableKeys.js runs it for every keydown.

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
export const TURN_KEYS = {
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
}
// Previous / next card in the roster popup (RosterPopup.jsx): key code → step
export const CARD_STEP_KEYS = { ArrowLeft: -1, ArrowRight: 1 }
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
// Ping, P (TTS uses it for the camera mode): a ping at the pointer. See handlePingKey in components/usePing.js.
export const PING_KEY = 'KeyP'
// Camera back to the start view, as in TTS
export const RESET_VIEW_KEY = 'Space'
// Keys that act on the first press only, not on key repeat: key code → action name of keyAction
export const PRESS_KEYS = {
  [FLIP_KEY]: 'flip',
  [LIFT_KEY]: 'lift',
  [LOCK_KEY]: 'lock',
  [PING_KEY]: 'ping',
}
// Deletes the piece under the pointer, as in TTS: a character token on the table, an unlocked
// terrain piece and others (see deleteTarget in hover.js). A Mac keyboard's delete key sends Backspace.
export const DELETE_KEYS = ['Delete', 'Backspace']

// Keys in a text field or a select edit it (letters type, arrow keys move the cursor or the option), so the app does not use them
export function isEditing(target) {
  return Boolean(target.closest?.('input, textarea, select, [contenteditable]'))
}

// What a key press does. e: the keydown event. s: the app state now, read at the key press:
// { tokenDrag, toolDrag, popup (a card, tray, roster or settings popup is open), rosterOpen, diceMenu,
// libraryOpen, logOpen, diceTray (side of the own dice tray under the pointer, or null) }.
// Returns { action, preventDefault?, ...arguments } or null (the key does nothing). The first match
// wins, in this order: Alt, a drag, a popup, Escape, the modifier and text field guard, the table keys.
export function keyAction(e, s) {
  if (e.key === 'Alt') {
    // Windows moves the focus to the browser menu on a bare Alt
    return {
      action: 'peek',
      preventDefault: true,
      blocked: !!(s.tokenDrag || s.toolDrag || s.popup),
    }
  }
  if (s.tokenDrag) {
    // Escape cancels the drag. Other keys do nothing while a token is under the pointer.
    return e.key === 'Escape' ? { action: 'cancelTokenDrag' } : null
  }
  if (s.toolDrag) {
    // The same for a tool dragged from the rack
    return e.key === 'Escape' ? { action: 'cancelToolDrag' } : null
  }
  if (s.popup) {
    // Escape closes only the popup. The left and right arrows show the previous or next roster card.
    // Other keys do nothing, so nothing changes on the table behind it.
    if (e.key === 'Escape') return { action: 'closePopups' }
    if (s.rosterOpen && CARD_STEP_KEYS[e.code])
      return { action: 'cardStep', step: CARD_STEP_KEYS[e.code] }
    return null
  }
  if (e.key === 'Escape') {
    // A dice tray die menu closes first, then the Library, before the table's own Escape behavior.
    if (s.diceMenu) return { action: 'closeDiceMenu' }
    if (s.libraryOpen) return { action: 'closeLibrary' }
    if (s.logOpen) return { action: 'closeLog' }
    return { action: 'escape' }
  }
  if (e.metaKey || e.ctrlKey || e.altKey || isEditing(e.target)) return null
  if (DELETE_KEYS.includes(e.key)) return { action: 'delete' }
  if (PAN_KEYS[e.code]) return { action: 'pan', code: e.code }
  if (TURN_KEYS[e.code]) return { action: 'turn', code: e.code }
  if (e.code === RESET_VIEW_KEY) {
    // Space also presses the focused button, for example the last clicked toolbar button
    return { action: 'reset', preventDefault: true, first: !e.repeat }
  }
  if (ROTATE_KEYS[e.code]) return { action: 'rotate', code: e.code, first: !e.repeat }
  if (e.repeat) return null
  if (PRESS_KEYS[e.code]) return { action: PRESS_KEYS[e.code] }
  // Over an own dice tray, the number keys clear the tray, then add dice, not tools. Over the other tray they spawn tools.
  if (DICE_KEYS[e.key] && s.diceTray)
    return { action: 'dice', side: s.diceTray, count: DICE_KEYS[e.key] }
  if (RANGE_KEYS[e.key]) return { action: 'range', value: RANGE_KEYS[e.key] }
  if (MOVE_KEYS[e.key]) return { action: 'move', value: MOVE_KEYS[e.key] }
  if (e.key === ANGLE_KEY) return { action: 'angle' }
  if (e.key === CLEAR_TOOLS_KEY) return { action: 'clear' }
  return null
}

// Sends every keydown and keyup on the window, and the window blur, to the handlers of the last
// render, so the handlers read the current app state. The listeners are added once.
export function useWindowKeys(onKeyDown, onKeyUp, onBlur) {
  const handlers = useRef(null)
  useLayoutEffect(() => {
    handlers.current = { onKeyDown, onKeyUp, onBlur }
  })
  useEffect(() => {
    const down = (e) => handlers.current.onKeyDown(e)
    const up = (e) => handlers.current.onKeyUp(e)
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
