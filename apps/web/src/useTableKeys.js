import { useRef } from 'react'
import { PAN_KEYS, ROTATE_KEYS, TURN_KEYS, keyAction, useWindowKeys } from './keyboard.js'

// Every key event of the window. Key down: keyAction decides, then the handler of that action runs.
// state(): the app state now, called at every key press (see keyAction). actions: action name → handler,
// called with the keyAction result; the pan, turn and rotate keys are handled here, with turnPiece(dir)
// from the caller for the piece turn. altUp(): the Alt key was released or the window lost focus.
// Call it last in App: the handlers read everything that the hooks above it give.
export function useTableKeys({ state, actions, turnPiece, altUp }) {
  // Pan and turn keys held down: key code → screen direction. KeyboardCamera moves the camera while one is held.
  const heldPan = useRef(new Map())
  const heldTurn = useRef(new Map())
  // Q / E held down: key code → direction. Scene turns the piece on while one is held (see turnPiece).
  const heldRotate = useRef(new Map())

  const own = {
    pan: (a) => heldPan.current.set(a.code, PAN_KEYS[a.code]),
    turn: (a) => heldTurn.current.set(a.code, TURN_KEYS[a.code]),
    rotate: (a) => {
      heldRotate.current.set(a.code, ROTATE_KEYS[a.code])
      // Scene turns the piece on while the key is held, at the same speed on every computer. So
      // the key repeat of the system does not turn it.
      if (a.first) turnPiece(ROTATE_KEYS[a.code])
    },
  }

  // Every keydown of the app is handled here, so that the same key can do different things in
  // different states. The keys are in keyboard.js.
  function handleKeyDown(e) {
    const result = keyAction(e, state())
    if (!result) return
    if (result.preventDefault) e.preventDefault()
    ;(own[result.action] ?? actions[result.action])(result)
  }

  function handleKeyUp(e) {
    if (e.key === 'Alt') {
      altUp()
    }
    heldPan.current.delete(e.code)
    heldTurn.current.delete(e.code)
    heldRotate.current.delete(e.code)
  }

  // A key released outside the window sends no keyup
  function handleBlur() {
    altUp()
    heldPan.current.clear()
    heldTurn.current.clear()
    heldRotate.current.clear()
  }

  useWindowKeys(handleKeyDown, handleKeyUp, handleBlur)

  return { heldPan, heldTurn, heldRotate }
}
