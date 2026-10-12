// What the other browser sees when a player puts a token down on the table (docs/features/sounds.md). Plain
// module, so node tests can load it.

// The table list of each piece kind that a token drag claims (net/livePose.js, tokenDragKey)
const LISTS = { token: 'tokens', loose: 'looseTokens', pile: 'tokenPiles' }

// The list name and the id of a drag key, or null for a key that is no token (a model, a tactic card, a die)
export function tokenKeyParts(key) {
  const i = key.indexOf(':')
  const list = LISTS[key.slice(0, i)]
  return list ? { list, id: key.slice(i + 1) } : null
}

// A claim on a token ended. before: the entry when the claim started, after: the entry now (null for none).
// True for a drop on the table: the piece exists, no character holds it, and it is new or moved. A cancel
// changes nothing, a drop on a character holds the token or removes the loose one.
export function isTableDrop(before, after) {
  if (!after || after.heldBy) return false
  return !before || before.x !== after.x || before.z !== after.z
}
