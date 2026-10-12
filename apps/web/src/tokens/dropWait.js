// Objective tokens that wait for their place (docs/features/character-trays.md, "Hold and drop"). A dropped token
// has `placeBy` (the side that places it) and `placeFrom` { characterId, x, z, radius, offBoard } while it waits.
// Plain module, no React.

// The side that places a token that a character of `team` drops. placer: 'opponent' or 'controller'
// (characters/dropPlacer.js).
export function placerSide(team, placer) {
  return placer === 'controller' ? team : team === 'host' ? 'guest' : 'host'
}

// The tokens that wait for their place
export const waitingTokens = (tokens) => tokens.filter((t) => t.placeBy)

// The waiting tokens of one character, grouped for the notice: [{ characterId, placeBy, tokens }], in the order
// of the first token of each character.
export function waitGroups(tokens) {
  const groups = []
  for (const token of waitingTokens(tokens)) {
    const characterId = token.placeFrom?.characterId ?? null
    let group = groups.find((g) => g.characterId === characterId)
    if (!group) {
      group = { characterId, placeBy: token.placeBy, tokens: [] }
      groups.push(group)
    }
    group.tokens.push(token)
  }
  return groups
}

// "Asset", "Asset and Civilian", "Asset, Civilian and Asset"
export function joinNames(names) {
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

// One line of the notice, and the title of the disabled Remove. mine: this browser plays the side that places.
// name: the character. tokenNames: the names of its waiting tokens. placer: the name of the placing player.
export function waitText({ mine, name, tokenNames, placer }) {
  const what = `${name}'s ${joinNames(tokenNames)}`
  return mine ? `Place ${what} within Range 2` : `Waiting for ${placer} to place ${what}`
}

// The characters whose models go back on their cards when the tokens `placedIds` are placed: the character had
// **Remove** (`placeFrom.offBoard`) and no other token of it waits. tokens: the table before the placing.
export function modelsToReturn(tokens, placedIds) {
  const placed = tokens.filter((t) => placedIds.includes(t.id) && t.placeBy)
  const ids = [
    ...new Set(placed.filter((t) => t.placeFrom?.offBoard).map((t) => t.placeFrom.characterId)),
  ]
  return ids.filter(
    (id) =>
      !tokens.some(
        (t) => t.placeBy && !placedIds.includes(t.id) && t.placeFrom?.characterId === id,
      ),
  )
}

// The token after it is placed at (x, z), or where it lies when point is null. Clears the wait.
export function placedToken(token, point) {
  return { ...token, ...point, heldBy: null, heldAt: null, placeBy: null, placeFrom: null }
}
