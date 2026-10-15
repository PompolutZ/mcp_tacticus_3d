// The count rules of a collected token's pile (docs/features/team-tactic-cards.md, "Collected tokens"). A
// loose token of a collected kind has an optional `count` (absent = 1). `pile` links it to the pile that
// a click adds to. Plain code, no React, so the browsers and the tests get the same result.

export const countOf = (token) => token.count ?? 1

// The token with `count` set. Count 1 has no field.
function withCount(token, count) {
  const { count: _old, ...rest } = token
  return count > 1 ? { ...rest, count } : rest
}

// A token with one more
export const addOne = (token) => withCount(token, countOf(token) + 1)

// A token after one is taken off it
export const takeOne = (token) => withCount(token, Math.max(1, countOf(token) - 1))

// `target` takes the count of `dragged`: the counts add up
export const mergeCounts = (target, dragged) =>
  withCount(target, countOf(target) + countOf(dragged))

// The loose token of `pile` (the same key and `pile` link), or undefined
const pileToken = (loose, pile) => loose.find((t) => t.key === pile.key && t.pile === pile.id)

// The loose token of the same key that a token dropped at `point` ({ x, z }) joins: the last one in the
// list (the one on top) whose circle holds the point. radius: half the token size. excludeId: the dragged token.
export function mergeTarget(loose, key, point, radius, excludeId = null) {
  for (let i = loose.length - 1; i >= 0; i--) {
    const t = loose[i]
    if (t.key === key && t.id !== excludeId && Math.hypot(t.x - point.x, t.z - point.z) <= radius)
      return t
  }
  return undefined
}

// Where the first token of a pile goes: the center of its card, else a free spot near the pile.
// card: { x, z } | null. obstacles: [{ x, z }], the tokens and piles that the spot keeps clear of.
// size: the token width.
export function firstPlace(pile, card, obstacles, size) {
  if (card) return { x: card.x, z: card.z }
  for (let ring = 1; ring <= 4; ring++) {
    const distance = (size + 0.3) * ring
    for (let step = 0; step < 8; step++) {
      const angle = (step * Math.PI) / 4
      const spot = {
        x: pile.x + Math.cos(angle) * distance,
        z: pile.z + Math.sin(angle) * distance,
      }
      if (!obstacles.some((o) => Math.hypot(o.x - spot.x, o.z - spot.z) < size)) return spot
    }
  }
  return { x: pile.x + size + 0.3, z: pile.z }
}

// The loose list after a click on `pile`: the token of the pile gets 1 more, or a first token (id `newId`)
// lies at `place`.
export function clickAdd(loose, pile, place, newId) {
  const found = pileToken(loose, pile)
  if (found) return loose.map((t) => (t.id === found.id ? addOne(t) : t))
  return [...loose, { id: newId, key: pile.key, x: place.x, z: place.z, pile: pile.id }]
}

// The loose list after a collected token is dropped on the table at `point`. dragged: the dragged token
// (a moved one, or a new single one). takeFrom: the id of the counted token that gave one up, or null.
// A same-kind token under `point` takes the count of `dragged`. Else `dragged` lies at `point`.
// A moved token goes to the end of the list, so it lies on top (tokens/stack.js).
export function dropCollected(loose, dragged, point, radius, takeFrom = null) {
  let list = loose
  if (takeFrom) list = list.map((t) => (t.id === takeFrom ? takeOne(t) : t))
  const target = mergeTarget(list, dragged.key, point, radius, dragged.id)
  list = list.filter((t) => t.id !== dragged.id)
  if (target) return list.map((t) => (t.id === target.id ? mergeCounts(t, dragged) : t))
  return [...list, { ...dragged, x: point.x, z: point.z }]
}
