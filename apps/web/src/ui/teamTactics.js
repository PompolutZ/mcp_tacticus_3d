import { sideSign } from '../setup/setup.js'

// The Team tactics list of a Streamer column (docs/features/spectator-view.md, "Squad columns"): the
// cards of `team`, in slot order (from the owner's left, as tactics/layout.js numbers the slots).
// A card the player flipped (`up === 'back'`) is used.
// cards: [{ id, key, team, x, up }]. nameOf(key) gives the card name.
// Returns { items: [{ id, key, name, used }], used, total }.
export function teamTactics(cards, team, nameOf) {
  const sign = sideSign(team)
  const items = cards
    .filter((card) => card.team === team)
    .sort((a, b) => a.x * sign - b.x * sign)
    .map((card) => ({
      id: card.id,
      key: card.key,
      name: nameOf(card.key),
      used: card.up === 'back',
    }))
  return { items, used: items.filter((item) => item.used).length, total: items.length }
}
