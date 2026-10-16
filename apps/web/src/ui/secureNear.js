import { rangeLength } from '../tabletools/toolTips.js'

// Which Secure tokens the spectator badge shows (SpectatorBadge.jsx). Plain module, so node --test can load it.

// Physics can nudge a resting base a little, so a small gap still counts, the same as the R1 tool
// (toolGeometry.js, CONTACT_EPS).
const CONTACT_EPS = 0.01

// The ids of the tokens that the model contests: edge to edge, seen from above, within range (a tool size,
// tabletools/toolTips.js, rangeLength: a model at the far end of the Range 2 tool shows the token).
// center: { x, z } of the base. tokens: [{ id, x, z }]. held: the player still controls the placement
// (drag, lift, throw, settling), so nothing is shown. Else the player would learn the contest before
// committing the placement (docs/features/spectator-view.md).
export function nearSecureIds(center, baseRadius, tokenRadius, tokens, range, held = false) {
  if (held) return []
  return tokens
    .filter(
      (t) =>
        Math.hypot(t.x - center.x, t.z - center.z) - baseRadius - tokenRadius <=
        rangeLength(range) + CONTACT_EPS,
    )
    .map((t) => t.id)
}

// The model placement is not final: this player drags or lifts it (lift.isBusy), or the other player does, or
// its body still moves. owner: ownership.owner(key). A claim lasts until the body rests (useModelSync.js).
export function placementHeld({ owner, dragging, lifted, asleep }) {
  return Boolean(owner) || dragging || lifted || !asleep
}
