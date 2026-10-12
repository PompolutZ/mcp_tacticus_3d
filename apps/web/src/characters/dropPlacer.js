// Who places an objective token that a character drops: its opponent (rulebook), or the controlling player
// when the superpower text of the side that faces up says "instead of their opponent" (S.H.I.E.L.D. Agents,
// The Black Widow). Read from the Jarvis stat card, the same way as immunity.js. See
// docs/features/character-trays.md, "Hold and drop".

const CONTROLLER_TEXT = /instead of their opponent/i

// Stat cards of a Jarvis row: the card, and the card of the second form when it has one.
function forms(jch) {
  return [jch.statCard, jch.secondStatCard].filter(Boolean)
}

// True when a stat card side has a superpower that makes the controlling player place the token
function sideControls(card, sideName) {
  return (card[sideName]?.superPowers ?? []).some((p) => CONTROLLER_TEXT.test(p.body ?? ''))
}

// 'controller' or 'opponent'. character: { side } ('healthy' or 'injured', the side that faces up). The app
// does not know which form is in use, so every form must say it, as for immunities.
export function dropPlacer(character, jarvisRow) {
  const sideName = character.side === 'injured' ? 'backSide' : 'frontSide'
  const cards = forms(jarvisRow)
  return cards.length > 0 && cards.every((card) => sideControls(card, sideName))
    ? 'controller'
    : 'opponent'
}
