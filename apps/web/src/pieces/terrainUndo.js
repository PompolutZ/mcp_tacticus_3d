import { droppedY } from '../rooms/table.js'

// The undo of a terrain delete (docs/features/game-log.md, "Panel"). Plain module, no React.

const round = (v) => Math.round(v * 1e4) / 1e4

// The data of a `terrainDeleted` log entry (log/log.js). piece: the stored piece that left the table
// ({ id, index, locked, y? }), pieceKey: its key in TERRAIN_PIECES (the name in the text), placed: the terrain with placements before the delete (withPlacements), fall: the result of planFall.
// terrain: [{ id, from, to }], the height of each piece that fell before and after (inches, as `y`).
// models: [{ id, delta, pose }], the fall of each model and its pose after it.
export function deleteEntryData(piece, mapId, placed, fall) {
  return {
    piece,
    pieceKey: placed.find((p) => p.id === piece.id)?.piece,
    mapId,
    terrain: Object.entries(fall.terrain).flatMap(([id, delta]) => {
      const was = placed.find((p) => p.id === id)
      if (!was) return []
      return [{ id, from: was.position[1], to: droppedY(was.position, delta) }]
    }),
    models: Object.entries(fall.models).map(([id, { delta, pose }]) => ({ id, delta, pose })),
  }
}

// A model counts as not moved since the fall when its stored pose is this close (inches, radians) to the one
// after the fall. After the fall the body settles on the surface, and its rest pose differs a little from
// the pose that was applied, so an exact compare would skip every rise.
export const SAME_POSE_MOVE = 0.05
export const SAME_POSE_TURN = 0.02

export function samePose(a, b) {
  if (!a || !b) return false
  if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > SAME_POSE_MOVE) return false
  const dot = a.qx * b.qx + a.qy * b.qy + a.qz * b.qz + a.qw * b.qw
  return 2 * Math.acos(Math.min(1, Math.abs(dot))) <= SAME_POSE_TURN
}

// What an undo does. entry: the `terrainDeleted` entry, stored: the stored terrain list now, placed: the
// terrain with placements now, poses: the stored model poses now.
// Returns { terrain, rises }: the new stored list (the piece back with its id; a piece that fell gets its
// old `y` only when its height is still the one after the fall), and the models that go up:
// [{ id, pose }] (only a model whose stored pose is still the one after the fall).
export function undoPlan(entry, stored, placed, poses) {
  const back = new Map(entry.terrain.map((f) => [f.id, f]))
  const terrain = stored.map((p) => {
    const fall = back.get(p.id)
    const now = placed.find((q) => q.id === p.id)
    return fall && now && now.position[1] === fall.to ? { ...p, y: fall.from } : p
  })
  const rises = entry.models
    .filter((m) => samePose(poses[m.id], m.pose))
    .map((m) => ({ id: m.id, pose: { ...m.pose, y: round(m.pose.y + m.delta) } }))
  return { terrain: [...terrain, entry.piece], rises }
}
