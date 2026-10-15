// Texts and state of the Power and Cleanup phases, as plain functions (no React, no JSON). The caller
// passes the lookups. See docs/features/round-phases.md.

import { cleanupBlockers } from '../characters/cleanup.js'
import { characterOnBoard } from '../characters/models.js'

// Cleanup chip state (docs/features/round-phases.md, decision 8): off while a character on the board has neither Activated nor Dazed, and
// while no character is on the board. nameOf(key): the name of a character. Returns { blocked, empty, disabled, title }.
export function cleanupStatus(characters, poses, nameOf) {
  const blocked = cleanupBlockers(characters, poses)
  const empty = !characters.some((ch) => characterOnBoard(ch, poses))
  const disabled = empty || blocked.length > 0
  const title = empty
    ? 'Cleanup Phase: no character is on the board.'
    : blocked.length > 0
      ? `Each character on the board needs an Activated or Dazed token: ${blocked.map((ch) => nameOf(ch.key)).join(', ')}.`
      : 'Cleanup Phase for both players. Score VP first.'
  return { blocked, empty, disabled, title }
}

// The HUD message of the Power Phase. gains: [{ name, from, to }]. sides: the sides that gained. With one
// side, the message names its color: colorName(side).
export function powerPhaseText(gains, sides, colorName) {
  const title = sides.length === 1 ? `Power Phase (${colorName(sides[0])})` : 'Power Phase'
  return gains.length === 0
    ? `${title}: none of your characters is on the board`
    : `${title}: ${gains.map((g) => `${g.name} ${g.from} → ${g.to}`).join(', ')}`
}

// The HUD message of the Cleanup Phase. round: the new round number, or null when the marker did not move.
// flipped: names of the flipped characters. note: the Priority note, "" for none.
export function cleanupText(round, flipped, note) {
  const head =
    round === null
      ? 'Cleanup Phase: the round marker is not on the round track, so it did not move.'
      : `Cleanup Phase: round ${round}.`
  const text = flipped.length > 0 ? `${head} Flipped: ${flipped.join(', ')}.` : head
  return note ? `${text} ${note}` : text
}
