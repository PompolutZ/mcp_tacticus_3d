// What the tray controls do and say, shared by the DOM controls (TrayControls.jsx: the tray popup, the
// Streamer badge) and the 3D strip on the table (TrayStrip3D.jsx). Plain module, no React, so a test can
// read it. See docs/features/character-trays.md, "Controls".

const REMOVE_TITLE =
  'Remove from the board: the model goes back on its card. Delete key over the card deletes the character.'

// Remove is off while no model of the character is on the mat (onBoard false) and while a dropped token
// waits for its place (removeWait, its text). The title is the wait text then.
export function removeState({ onBoard, removeWait = null }) {
  return { disabled: !onBoard || Boolean(removeWait), title: removeWait ?? REMOVE_TITLE }
}

export const INJURED_FILL = 'rgba(150, 30, 30, 0.85)'
export const INJURED_LINE = '#e5484d'

// The counters of a character, in order: Damage (value / Stamina, warn at Stamina), and Power (value / 10)
// unless a grunt (character.host), which has none. injured: the Damage counter of a character on the
// Injured side, drawn with a red border and tint (INJURED_FILL and INJURED_LINE; .tray-counter--injured in
// index.css has the same colors).
export function trayCounters(character, stamina) {
  const counters = [
    {
      kind: 'damage',
      alt: 'Damage',
      value: character.damage,
      max: stamina,
      warn: character.damage >= stamina,
      injured: character.side === 'injured',
    },
  ]
  if (!character.host) {
    counters.push({ kind: 'power', alt: 'Power', value: character.power, max: 10, warn: false })
  }
  return counters
}

// What a click on part of a counter changes: the -/+ buttons, and the body (icon or value) where a left
// click adds 1 and a right click takes 1, as in TTS. zone: 'dec' | 'inc' | 'body'. button: 0 left, 2 right.
// A right click on a button does nothing.
export function counterStep(zone, button) {
  if (zone === 'body') return button === 0 ? 1 : button === 2 ? -1 : 0
  if (button !== 0) return 0
  return zone === 'inc' ? 1 : -1
}

// Changes the counter by `step`. onDamage and onPower clamp (actions.js), so no limit here.
export function applyCounter(character, kind, step, { onDamage, onPower }) {
  if (!step) return
  if (kind === 'damage') onDamage?.(character.damage + step)
  else onPower?.(character.power + step)
}

// The Damage + Power button (3D strip): `step` on both counters through the same applyCounter, so the same
// clamps apply. +1 does nothing while either counter is at its limit (bothDisabled), so the two never get
// out of step; -1 always runs (a counter at 0 stays, the other still drops).
export const BOTH_LABEL = '+1 Dmg & Pwr'
const BOTH_TITLE = 'Add 1 Damage and 1 Power. Right click takes 1 of each.'
const BOTH_LIMIT_TITLE =
  'Damage is at Stamina or Power is at its max, so +1 is off. Right click still takes 1 of each.'
export function bothTitle(character, stamina) {
  return bothDisabled(character, stamina) ? BOTH_LIMIT_TITLE : BOTH_TITLE
}
export function applyBoth(character, step, stamina, handlers) {
  if (step > 0 && bothDisabled(character, stamina)) return
  applyCounter(character, 'damage', step, handlers)
  applyCounter(character, 'power', step, handlers)
}

// The button is faded when either counter is at its limit (Damage at Stamina, or Power at its max). A left
// click (+1) does nothing then (applyBoth); right click (-1) still works.
export function bothDisabled(character, stamina) {
  const [damage, power] = trayCounters(character, stamina)
  return damage.value >= damage.max || power.value >= power.max
}

// The part of a counter at local x (inches from its center) of a counter `width` wide: the - button on
// the left, the + button on the right, the body between. A button is BUTTON_ZONE wide.
export const BUTTON_ZONE = 0.76
export function counterZone(x, width) {
  if (x <= -width / 2 + BUTTON_ZONE) return 'dec'
  if (x >= width / 2 - BUTTON_ZONE) return 'inc'
  return 'body'
}

// A pointer that moved more than this many pixels between down and up was a drag (the camera turned), not
// a click on a tray part.
export const CLICK_MOVE = 4
