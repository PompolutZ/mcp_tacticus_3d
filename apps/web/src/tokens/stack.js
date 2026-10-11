// Tokens on top of tokens, without physics (docs/features/character-trays.md, "Tokens on top of tokens"). A loose
// character token lies on the highest token under its center: a crisis token, or a loose token that
// comes earlier in the looseTokens list. A token counts when the center is inside its circle.
// Piles do not stack and nothing stacks on a pile. Crisis tokens never lie on loose tokens.
// Plain code, no React and no Rapier, so the browsers get the same stack from the same positions and list.

// A token under the loose token: { x, z, radius, top, index }. top: the height of its upper face
// (markers included). index: its place in the looseTokens list, -1 for a crisis token.
// The center of a token at (x, z) with the list place `index` (Infinity: a new token, above all
// loose tokens). Returns the highest top, or null when no token is under it.
export function stackTop(x, z, index, crisis, loose) {
  let best = null
  for (const t of crisis) best = higher(best, t, x, z)
  for (const t of loose) if (t.index < index) best = higher(best, t, x, z)
  return best
}

function higher(best, t, x, z) {
  if (Math.hypot(x - t.x, z - t.z) > t.radius) return best
  return best === null || t.top > best ? t.top : best
}

// The live tokens under a loose token, shared by the components with no React state: each token
// writes its place and top every frame, a loose token reads. A token that is lifted (dragged) is not
// in it, so the token on top goes down when the one below is picked up.
export function createTokenStack() {
  const crisis = new Map()
  const loose = new Map()

  function put(map, id, x, z, radius, top, index) {
    const entry = map.get(id)
    if (entry) Object.assign(entry, { x, z, radius, top, index })
    else map.set(id, { x, z, radius, top, index })
  }

  return {
    putCrisis: (id, x, z, radius, top) => put(crisis, id, x, z, radius, top, -1),
    removeCrisis: (id) => crisis.delete(id),
    putLoose: (id, x, z, radius, top, index) => put(loose, id, x, z, radius, top, index),
    removeLoose: (id) => loose.delete(id),
    // The height to lie on at (x, z) for a token at list place `index`, or null
    topAt: (x, z, index = Infinity) => stackTop(x, z, index, crisis.values(), loose.values()),
  }
}

// The one stack of the scene
export const tokenStack = createTokenStack()
