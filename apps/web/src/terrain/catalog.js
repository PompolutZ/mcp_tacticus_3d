// The mats and the pieces of all maps, for the builder (docs/features/map-builder.md).
import { TERRAIN_PIECES } from './pieces.js'
import { MAPS } from './maps/index.js'

// The maps in the order of MAPS, then the placements in their order. A tie below goes to the first one.
const MAP_LIST = Object.values(MAPS)

// One entry per mat: { name, rotation }. The rotation is the matRotation of the first map that uses the mat.
export const MATS = (() => {
  const seen = new Map()
  for (const map of MAP_LIST) {
    if (!seen.has(map.mat)) seen.set(map.mat, { name: map.mat, rotation: map.matRotation })
  }
  return [...seen.values()]
})()

// The value that most placements have. A tie goes to the value that came first. `undefined` counts as a value.
function mostFrequent(values) {
  const counts = new Map()
  for (const value of values) {
    const k = JSON.stringify(value ?? null)
    const entry = counts.get(k)
    if (entry) entry.count++
    else counts.set(k, { value, count: 1 })
  }
  let best = null
  for (const entry of counts.values()) if (!best || entry.count > best.count) best = entry
  return best.value
}

// Group key 1 to 5 or 'none' (a placement without size) -> [{ key, name, size, scale, tint }], sorted by name.
// A piece with two sizes is in both groups. scale and tint: the most frequent at that piece and size
// (decision 9 of docs/plans/terrain-page.md). tint is undefined when the placements have none.
export const PIECES_BY_SIZE = (() => {
  const groups = {
    1: new Map(),
    2: new Map(),
    3: new Map(),
    4: new Map(),
    5: new Map(),
    none: new Map(),
  }
  for (const map of MAP_LIST) {
    for (const p of map.placements) {
      const group = groups[p.size ?? 'none']
      if (!group.has(p.piece)) group.set(p.piece, [])
      group.get(p.piece).push(p)
    }
  }
  // A piece with a default size that no map places is in its size group, with scale 1 and no tint
  for (const [key, piece] of Object.entries(TERRAIN_PIECES)) {
    const group = piece.size && groups[piece.size]
    if (group && !MAP_LIST.some((map) => map.placements.some((p) => p.piece === key))) {
      group.set(key, [{ piece: key, size: piece.size, scale: 1 }])
    }
  }
  const out = {}
  for (const [size, group] of Object.entries(groups)) {
    out[size] = [...group.entries()]
      .map(([key, placements]) => ({
        key,
        name: TERRAIN_PIECES[key].name,
        size: size === 'none' ? undefined : Number(size),
        scale: mostFrequent(placements.map((p) => p.scale)),
        tint: mostFrequent(placements.map((p) => p.tint)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  return out
})()
