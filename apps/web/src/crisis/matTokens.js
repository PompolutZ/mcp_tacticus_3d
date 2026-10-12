import { canFlip, canMove, hasArc, hasMarkers } from './cards.js'
import { SUPPLY_YAW } from '../net/livePose.js'

const DEG = Math.PI / 180

// Mat token entries of a card, as tracked in App state. Position and rotation come from cards.json
// (TTS x, z from the mat center, and TTS Y rotation), converted the same way as terrain: z -> -z.
// yaw: checked against the X-Men Infiltrate Secret Weapons Facility Zone map, see the report.
// The bottom edge of the map on the card is the side of the player with Priority (p9). cards.json has it
// at the host side. turned: the guest has Priority, so the map turns a half turn around the mat
// center (see docs/features/setup-game.md, "Priority").
export function buildMatTokens(card, turned) {
  const marked = hasMarkers(card)
  const sign = turned ? -1 : 1
  return card.tokens.map((t) => ({
    id: crypto.randomUUID(),
    cardKey: card.key,
    frontKey: t.token,
    backKey: t.back ?? null,
    up: 'front',
    x: t.position[0] * sign,
    z: -t.position[1] * sign,
    yaw: Math.PI - (t.rotation ?? 180) * DEG + (turned ? Math.PI : 0),
    canMove: canMove(t),
    canFlip: canFlip(t),
    hasArc: hasArc(t),
    hasMarkers: marked,
    // Only Asset and Civilian can be held (p22); a Source stays on the mat and gives out its
    // supply instead (see supplyToken, docs/features/character-trays.md, "Hold and drop").
    canHold: card.type === 'extract' && canMove(t),
    heldBy: null, // character id, or null while the token sits on the mat
    heldAt: null, // tray-local [x, z] on the holder's card while held (see characters/trays.js)
    control: null,
    damage: false,
  }))
}

// A new supply token of a Source card, taken from its pile (see SupplyPile.jsx and
// handleSupplyTake). It lies on the table at (x, z), or a character holds it.
export function supplyToken(card, x, z, id) {
  return {
    id,
    cardKey: card.key,
    frontKey: card.supply,
    backKey: null,
    up: 'front',
    x,
    z,
    yaw: SUPPLY_YAW,
    canMove: true,
    canFlip: false,
    hasArc: false,
    hasMarkers: false,
    canHold: true, // a Source's supply is the same Asset/Civilian token, see buildMatTokens above
    heldBy: null,
    heldAt: null,
    control: null,
    damage: false,
  }
}
