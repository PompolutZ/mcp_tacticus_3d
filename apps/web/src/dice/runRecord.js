// The record of one throw for the overnight test run (docs/plans/dice-night-run.md, decision 2).
// Pure, so node --test can load it. Used only by the test hook in DiceTray.jsx.
import { FACES } from './faces.js'

// clicks: { sent, acted, blocked }. throwTime: s from the first click to the throw end.
// dice: [{ face, dot, tilted, timedOut, outOfWell, lost, restTime }], lost: how many times the
// die was thrown again from above the well, restTime: s from the first click to its rest.
export function buildRunRecord({ clicks, throwTime, dice }) {
  return {
    diceCount: dice.length,
    clicksSent: clicks.sent,
    clicksActed: clicks.acted,
    clicksBlocked: clicks.blocked,
    throwTime,
    dice: dice.map((d) => ({
      face: d.face,
      symbol: FACES[d.face - 1].symbol,
      dot: d.dot,
      tilted: !!d.tilted,
      timedOut: !!d.timedOut,
      outOfWell: !!d.outOfWell,
      lost: d.lost ?? 0,
      restTime: d.restTime,
    })),
  }
}
