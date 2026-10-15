import { useEffect, useLayoutEffect, useRef } from 'react'
import { defaultBindings, getAction, inputFromEvent, match } from './input/bindings.js'

// Every key the app uses is in input/bindings.js (the actions and their default keys; the user can
// change them, docs/features/key-shortcuts.md). keyAction below decides what a key press does, so that
// the same key can do different things in different app states. useTableKeys.js runs it for every keydown.

// Previous / next card in the other popups (dialogs with their own arrow keys): key code → step
export const CARD_STEP_KEYS = { ArrowLeft: -1, ArrowRight: 1 }

// Keys in a text field or a select edit it (letters type, arrow keys move the cursor or the option), so the app does not use them
export function isEditing(target) {
  return Boolean(target.closest?.('input, textarea, select, [contenteditable]'))
}

// What a key press does. e: the keydown event. s: the app state now, read at the key press:
// { tokenDrag, toolDrag (a token or tool is dragged), modelDrag (a model is dragged), drag (any pointer drag is in progress: Esc cancels it), popup (a card, tray, roster or settings popup is open), rosterOpen, diceMenu,
// libraryOpen, logOpen, diceTray (side of the own dice tray under the pointer, or null), overPiece,
// bindings (the bindings in use, input/bindings.js; the defaults when missing) }.
// Returns { action, id, preventDefault?, ...arguments } or null (the key does nothing). id: the
// action of the binding. The binding that fits comes from match (input/bindings.js). Then, in this
// order: the card peek always works; during a token or tool drag only cancel and the camera keys (pan, turn) work; in a popup only cancel and the
// bindings for a popup work; the text field guard; the key repeat guard.
export function keyAction(e, s) {
  const now = {
    popup: !!s.popup,
    dragging: !!(s.tokenDrag || s.toolDrag),
    modelDrag: !!s.modelDrag,
    overDiceTray: !!s.diceTray,
    overPiece: !!s.overPiece,
  }
  const input = inputFromEvent(e)
  const found = match(input, now, s.bindings ?? defaultBindings())
  if (!found) return null
  const def = getAction(found.id)
  // A bound Cmd or Ctrl combo would also do the browser's own action
  const prevent = def.preventDefault || input.ctrl || input.meta
  const result = (extra) => ({ ...extra, id: def.id, ...(prevent && { preventDefault: true }) })
  if (def.action === 'peek') return result({ action: 'peek', blocked: now.dragging || now.popup })
  if (def.action === 'cancel') {
    // Escape cancels the drag in progress (any piece, token or tool: drag/pointerDrag.js), else closes
    // only the popup. A model drag is one of them: Esc puts the model back, and clears no selection.
    if (s.drag) return result({ action: 'cancelDrag' })
    if (s.popup) return result({ action: 'closePopups' })
    // A dice tray die menu closes first, then the Library, before the table's own Escape behavior.
    if (s.diceMenu) return result({ action: 'closeDiceMenu' })
    if (s.libraryOpen) return result({ action: 'closeLibrary' })
    if (s.logOpen) return result({ action: 'closeLog' })
    return result({ action: 'escape' })
  }
  // A token or tool drag blocks every key but the camera ones (pan, turn): the camera moves while dragging, as in TTS
  if (now.dragging && def.action !== 'pan' && def.action !== 'turn') return null
  if (now.popup) {
    // The left and right arrows show the previous or next roster card. Other keys do nothing, so
    // nothing changes on the table behind it.
    if (found.binding.when !== 'popup' || (def.action === 'cardStep' && !s.rosterOpen)) return null
  } else if (isEditing(e.target)) return null
  if (e.repeat && !def.repeats) return null
  const extra = { action: def.action }
  if (def.dir) extra.dir = def.dir
  if (def.step) extra.step = def.step
  if (def.value !== undefined) extra.value = def.value
  if (def.first) extra.first = !e.repeat
  if (def.action === 'dice') {
    extra.side = s.diceTray
    extra.count = def.count
  }
  return result(extra)
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
