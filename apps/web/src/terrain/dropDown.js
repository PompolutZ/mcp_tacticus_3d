// What falls when a terrain piece is deleted, and how far. Pure parts: the Rapier queries that feed them
// are in terrain/dropQuery.js. See docs/features/maps.md, "Delete".

// A surface this far under the bottom of a piece or a base (inches) is what it stands on
export const STAND_GAP = 0.2
// Queries start this far above the bottom, so a piece that sinks a little into its support still hits it
export const STAND_LIFT = 0.3
// A fall shorter than this (inches) is no fall
export const MIN_FALL = 0.02

// The centers of an n x n grid of cells over the box { minX, maxX, minZ, maxZ }, as [{ x, z }]
export function sampleGrid({ minX, maxX, minZ, maxZ }, n = 4) {
  const points = []
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      points.push({
        x: minX + ((maxX - minX) * (i + 0.5)) / n,
        z: minZ + ((maxZ - minZ) * (j + 0.5)) / n,
      })
    }
  }
  return points
}

// The ids of the terrain pieces that a thing stands on. hits: [{ id, gap }], one for each query under it.
// id is null for the table. gap: how far the surface is under the bottom of the thing.
export function standsOnIds(hits, gap = STAND_GAP) {
  const ids = new Set()
  for (const hit of hits) if (hit.id != null && hit.gap <= gap) ids.add(hit.id)
  return [...ids]
}

// How far a piece with its bottom at `bottom` falls, when the surfaces under it are at `surfaces` (heights).
// It stops on the highest one, or on the table (height `floor`). Never negative.
export function fallDelta(bottom, surfaces, floor = 0) {
  const land = Math.max(floor, ...surfaces)
  return Math.max(0, bottom - land)
}

// The things that fall when `removedId` goes, with how far, in order: [{ key, delta }].
// standsOn: { key: [terrain ids it stands on] } for every thing that can fall (terrain pieces and models,
// the caller chooses the keys). A key of a terrain piece is `terrain:<id>`; the removed piece is the id.
// landing(key): how far a thing that stood on the removed piece falls (a cast without the removed piece).
// A thing on a piece that falls goes down with it by the same delta (so a stack stays a stack).
export function dropPlan({ removedId, standsOn, landing }) {
  const delta = new Map()
  const queue = [removedId]
  while (queue.length) {
    const support = queue.shift()
    for (const [key, supports] of Object.entries(standsOn)) {
      if (delta.has(key) || !supports.includes(support)) continue
      delta.set(key, support === removedId ? landing(key) : delta.get(`terrain:${support}`))
      if (key.startsWith('terrain:')) queue.push(key.slice('terrain:'.length))
    }
  }
  return [...delta].filter(([, d]) => d >= MIN_FALL).map(([key, d]) => ({ key, delta: d }))
}
