import { useRef } from 'react'
import { getAction } from './input/bindings.js'
import { keyAction, useWindowKeys } from './keyboard.js'

// Every key event of the window. Key down: keyAction decides, then the handler of that action runs.
// state(): the app state now, called at every key press (see keyAction). actions: action name → handler,
// called with the keyAction result; the pan, turn and rotate keys are handled here, with turnPiece(dir)
// from the caller for the piece turn. altUp(): the card peek key was released or the window lost focus.
// Call it last in App: the handlers read everything that the hooks above it give.
export function useTableKeys({ state, actions, turnPiece, altUp }) {
  // Pan and turn keys held down: action id → screen direction [right, up]. KeyboardCamera moves the camera while one is held.
  const heldPan = useRef(new Map())
  const heldTurn = useRef(new Map())
  // Q / E held down: action id → direction. Scene turns the piece on while one is held (see turnPiece).
  const heldRotate = useRef(new Map())
  // Every held action ends at the keyup of its main key, not of a modifier: key code → action id
  const heldBy = useRef(new Map())

  const own = {
    pan: (a) => heldPan.current.set(a.id, a.dir),
    turn: (a) => heldTurn.current.set(a.id, a.dir),
    rotate: (a) => {
      heldRotate.current.set(a.id, a.dir)
      // Scene turns the piece on while the key is held, at the same speed on every computer. So
      // the key repeat of the system does not turn it.
      if (a.first) turnPiece(a.dir)
    },
  }

  // Every keydown of the app is handled here, so that the same key can do different things in
  // different states. The keys are in input/bindings.js.
  function handleKeyDown(e) {
    const result = keyAction(e, state())
    if (!result) return
    if (result.preventDefault) e.preventDefault()
    if (getAction(result.id).held) heldBy.current.set(e.code, result.id)
    ;(own[result.action] ?? actions[result.action])(result)
  }

  function handleKeyUp(e) {
    const id = heldBy.current.get(e.code)
    if (!id) return
    heldBy.current.delete(e.code)
    if (id === 'peek') altUp()
    heldPan.current.delete(id)
    heldTurn.current.delete(id)
    heldRotate.current.delete(id)
  }

  // A key released outside the window sends no keyup
  function handleBlur() {
    altUp()
    heldBy.current.clear()
    heldPan.current.clear()
    heldTurn.current.clear()
    heldRotate.current.clear()
  }

  useWindowKeys(handleKeyDown, handleKeyUp, handleBlur)

  return { heldPan, heldTurn, heldRotate }
}
