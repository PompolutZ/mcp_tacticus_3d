// Extra Power of a character in the Power Phase, from the superpower text of its Jarvis stat card
// sides, for example "During the Power Phase, this character gains 1 additional Power." Same idea as
// immunity.js. See docs/features/round-phases.md, "Facts from Jarvis".

// The Power gem (MCT code). It gives 2 Power in the Power Phase, the other gems 1.
export const POWER_GEM = '00250102'

// "During the Power Phase, this character gains N additional Power." after the markup is removed.
// The row text varies in the commas and stars around "Power Phase" (the markup is stripped first), and the
// French rows say "Pendant la Phase de Pouvoir, ce personnage gagne N Power supplémentaire."
// The "." must follow: "... for each Phoenix token it has" is a variable amount, not read.
const BONUS =
  /(?:Power Phase|Phase de Pouvoir),? (?:this character gains|ce personnage gagne) (\d+) (?:additional power|power supplémentaire)(?=\.)/gi

// Total fixed extra Power in one superpower text; 0 when there is none.
export function parsePowerBonus(text) {
  const plain = text.replace(/[|*!]/g, '')
  let sum = 0
  for (const [, n] of plain.matchAll(BONUS)) sum += Number(n)
  return sum
}

// Stat cards of a Jarvis row: the card, and the card of the second form when it has one.
function forms(jch) {
  return [jch.statCard, jch.secondStatCard].filter(Boolean)
}

// Extra Power of one stat card side ('frontSide' or 'backSide'); a side with several matching
// superpowers sums them.
function sideBonus(card, sideName) {
  const powers = card[sideName]?.superPowers ?? []
  return powers.reduce((sum, p) => sum + parsePowerBonus(p.body ?? ''), 0)
}

// Extra Power of each form of a Jarvis row: [{ healthy, injured }, ...].
export function formPowerBonus(jch) {
  return forms(jch).map((card) => ({
    healthy: sideBonus(card, 'frontSide'),
    injured: sideBonus(card, 'backSide'),
  }))
}

// { healthy, injured }: the smallest extra Power of the forms on that side. The app does not know
// which form is in use (same rule as sharedImmunities); 0 for a row with no form.
export function sharedPowerBonus(jch) {
  const all = formPowerBonus(jch)
  const least = (side) => (all.length ? Math.min(...all.map((f) => f[side])) : 0)
  return { healthy: least('healthy'), injured: least('injured') }
}

// New Power of a character after the Power Phase button (docs/features/round-phases.md, decision 1).
// bonus: extra Power of the side that faces up. gems: attached MCT codes, may be undefined.
// stun, poison: token counts. Grunts cannot have Power, so they stay as they are.
export function powerAfterPhase({ power, bonus = 0, gems, stun, poison, grunt }) {
  if (grunt) return power
  let p = Math.min(10, power + 1)
  if (poison > 0) p = Math.max(0, p - 1)
  // Stun: a gain of more than 1 becomes 1, so the extra Power and the gems give nothing.
  if (!(stun > 0)) {
    const gemPower = (gems ?? []).reduce((sum, code) => sum + (code === POWER_GEM ? 2 : 1), 0)
    p = Math.min(10, p + bonus + gemPower)
  }
  return p
}
