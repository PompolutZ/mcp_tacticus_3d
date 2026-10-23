import { useEffect, useState } from 'react'

// Flip animation shared by the Team Tactic card, the tray card and the crisis token: the piece turns 180°
// around a horizontal axis in FLIP_DURATION seconds. It goes up while it turns, so its edges stay
// above the table: at 90° it stands on its edge, FLIP_EDGE_GAP above the table. Both values were chosen by
// look, not measured in TTS. See docs/features/team-tactic-cards.md, "Card on the table".
export const FLIP_DURATION = 0.4
const FLIP_EDGE_GAP = 0.3

// The turn starts and ends slowly (smoothstep)
const ease = (t) => t * t * (3 - 2 * t)

// The turn: { flipped, from, to, time }. An angle that is an even multiple of π is the first side up, an
// odd multiple is the other side up. flipped: the side of the last flip. time: seconds since that flip,
// FLIP_DURATION when it is over. Each flip adds π to `to`, so the piece always turns the same way.
export function createFlip(flipped) {
  const angle = flipped ? Math.PI : 0
  return { flipped, from: angle, to: angle, time: FLIP_DURATION }
}

export const flipAngle = (flip) =>
  flip.from + (flip.to - flip.from) * ease(flip.time / FLIP_DURATION)

// A flip during a flip starts where the piece is. No change when the side is the same.
export function startFlip(flip, flipped) {
  if (flip.flipped === flipped) return
  flip.from = flipAngle(flip)
  flip.to += Math.PI
  flip.time = 0
  flip.flipped = flipped
}

// Moves the clock on by dt seconds and returns the angle
export function stepFlip(flip, dt) {
  flip.time = Math.min(flip.time + dt, FLIP_DURATION)
  return flipAngle(flip)
}

// Height of the piece above its resting place at this angle. turnWidth: the size of the piece across
// the axis, so half of it plus the gap is the lift at 90°.
export const flipLift = (angle, turnWidth) =>
  (turnWidth / 2 + FLIP_EDGE_GAP) * Math.abs(Math.sin(angle))

// flipped: false is the first side up, true the other. It starts in that state with no animation.
// Returns a stable { step(dt), turning() }: the caller's useFrame calls step(dt), gets the angle, and
// sets the rotation of the turning group and the lift (flipLift).
export default function useFlipTurn(flipped) {
  const [api] = useState(() => {
    const flip = createFlip(flipped)
    return {
      flip,
      step: (dt) => stepFlip(flip, dt),
      turning: () => flip.time < FLIP_DURATION,
    }
  })
  useEffect(() => {
    startFlip(api.flip, flipped)
  }, [api, flipped])
  return api
}
