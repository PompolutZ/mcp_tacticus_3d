import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { turnBody } from '../characters/base.js'

// A Q / E key held longer than this (s) turns the piece on at ROTATE_RATE (rad/s), 90° per second,
// the same as the arrow keys turn the camera. Picked by look, not measured in TTS.
const ROTATE_HOLD_DELAY = 0.3
const ROTATE_RATE = Math.PI / 2
// A turn is smoothed, the same way as the wheel zoom (WheelCamera.jsx). Each frame the piece does
// 1 − e^(−dt / time) of the turn that is left, so 95% of a step is done after three times this (s).
// Picked by look. When less than ROTATE_DONE (rad) is left, the rest is done in the same frame.
const ROTATE_SMOOTH_TIME = 0.06
const ROTATE_DONE = 1e-4

// The Q / E turns of Scene: the hovered and dragged piece, the turns that are not done yet, and the
// frame that does a part of each. Scene calls it before useModelSync: this frame runs first in a frame.
export function usePieceTurns({ heldRotate, turnStep, claimModel, liveCharBody }) {
  // The pieces that Q / E can turn (turnPiece): the character or tool under the pointer, and the one
  // that is dragged. { kind: 'character' | 'tool', id } | null. The id of a tool is 'range', 'move', 'angle' or 'los'.
  const hoveredPiece = useRef(null)
  const draggedPiece = useRef(null)
  // Tool ('move', 'range', 'angle' or 'los') → its turn(angle), see stepTool in RulerTool.jsx
  const toolTurns = useRef({})
  // Turns that are not done yet: piece key → { piece, left }, left in radians. See the useFrame below.
  const turnsLeft = useRef(new Map())
  // The piece of the last Q / E press, which a held key turns on, and the time since that press (s)
  const turnHold = useRef({ piece: null, time: 0 })

  // on: the piece is now the hovered or dragged one (true), or no longer (false)
  function trackPiece(ref, piece, on) {
    if (on) ref.current = piece
    else if (ref.current?.kind === piece.kind && ref.current.id === piece.id) ref.current = null
  }

  // Q / E press, as in TTS: turns the dragged character or tool, else the one under the pointer, by
  // turnStep (degrees, the setting) around its center. direction: 1 counter-clockwise seen from above, -1 clockwise.
  // The dragged piece comes first, so a turn during a drag does not go to a piece that the
  // pointer passes over. A held key keeps turning the same piece, even when the pointer leaves it.
  function turnPiece(direction) {
    const piece = draggedPiece.current ?? hoveredPiece.current
    turnHold.current = { piece, time: 0 }
    if (piece) addTurn(piece, direction * ((turnStep * Math.PI) / 180))
  }

  // Adds angle to the turn of the piece that is not done yet
  function addTurn(piece, angle) {
    // A model turn claims the model. A tool turn claims nothing.
    if (piece.kind === 'character' && !claimModel(piece.id)) return
    const key = `${piece.kind}:${piece.id}`
    const turn = turnsLeft.current.get(key)
    if (turn) turn.left += angle
    else turnsLeft.current.set(key, { piece, left: angle })
  }

  // Turns the piece by angle at once. Does nothing for a piece that is gone.
  function applyTurn(piece, angle) {
    if (piece.kind === 'tool') toolTurns.current[piece.id]?.(angle)
    if (piece.kind === 'character') {
      const body = liveCharBody(piece.id)
      if (body) turnBody(body, angle)
    }
  }

  // A held Q / E adds to the turn of its piece. Then every piece with a turn left does a part of it.
  useFrame((_, dt) => {
    let direction = 0
    for (const d of heldRotate.current.values()) direction += d
    const hold = turnHold.current
    hold.time += dt
    if (hold.piece && direction !== 0 && hold.time > ROTATE_HOLD_DELAY)
      addTurn(hold.piece, direction * ROTATE_RATE * dt)
    const part = 1 - Math.exp(-dt / ROTATE_SMOOTH_TIME)
    for (const [key, turn] of turnsLeft.current) {
      const angle = Math.abs(turn.left) < ROTATE_DONE ? turn.left : turn.left * part
      turn.left -= angle
      applyTurn(turn.piece, angle)
      if (turn.left === 0) turnsLeft.current.delete(key)
    }
  })

  return { hoveredPiece, draggedPiece, toolTurns, turnsLeft, trackPiece, turnPiece }
}
