import { droppedY } from '../rooms/table.js'

// The undo of a terrain delete (docs/features/game-log.md, "Panel"). Plain module, no React.

const round = (v) => Math.round(v * 1e4) / 1e4

// The data of a `terrainDeleted` log entry (log/log.js). piece: the stored piece that left the table
// ({ id, index, locked, y? }), boardKey: game.board.key, pieceKey: its key in TERRAIN_PIECES (the name in the text), placed: the terrain with placements before the delete (withPlacements), fall: the result of planFall.
// terrain: [{ id, from, to }], the height of each piece that fell before and after (inches, as `y`).
// models: [{ id, delta, pose, lifted? }], the fall of each model and its pose after it. lifted: the model was
// lifted (R) at the delete, its lift place went down and the model did not move; pose is that place.
export function deleteEntryData(piece, boardKey, mapId, placed, fall) {
  return {
    piece,
    pieceKey: placed.find((p) => p.id === piece.id)?.piece,
    boardKey,
    mapId,
    terrain: Object.entries(fall.terrain).flatMap(([id, delta]) => {
      const was = placed.find((p) => p.id === id)
      if (!was) return []
      return [{ id, from: was.position[1], to: droppedY(was.position, delta) }]
    }),
    models: Object.entries(fall.models).map(([id, { delta, pose, lifted }]) => ({
      id,
      delta,
      pose,
      ...(lifted && { lifted }),
    })),
  }
}

// A model counts as not moved since the fall when its stored pose is this close (inches, radians) to the one
// after the fall. After the fall the body settles on the surface, and its rest pose differs a little from
// the pose that was applied, so an exact compare would skip every rise.
export const SAME_POSE_MOVE = 0.05
export const SAME_POSE_TURN = 0.02

export function samePlace(a, b) {
  return Boolean(a && b) && Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= SAME_POSE_MOVE
}

export function samePose(a, b) {
  if (!samePlace(a, b)) return false
  const dot = a.qx * b.qx + a.qy * b.qy + a.qz * b.qz + a.qw * b.qw
  return 2 * Math.acos(Math.min(1, Math.abs(dot))) <= SAME_POSE_TURN
}

// What an undo does to the stored terrain. entry: the `terrainDeleted` entry, stored: the stored terrain list
// now, placed: the terrain with placements now.
// Returns { terrain }: the new stored list (the piece back with its id; a piece that fell gets its old `y`
// only when its height is still the one after the fall).
export function undoPlan(entry, stored, placed) {
  const back = new Map(entry.terrain.map((f) => [f.id, f]))
  const terrain = stored.map((p) => {
    const fall = back.get(p.id)
    const now = placed.find((q) => q.id === p.id)
    return fall && now && now.position[1] === fall.to ? { ...p, y: fall.from } : p
  })
  return { terrain: [...terrain, entry.piece] }
}

// The models that go back up. models: the entry models, poses: the stored model poses now, rests: model id ->
// the place before the lift of a model that is lifted now (a lifted model keeps its old stored pose, so the
// live place decides). A model is not moved since the fall when it is still near the pose after it (the
// heading of a model that was lifted at the delete may differ: a Q / E turn in the lift, so only its place counts).
// Returns [{ id, delta }] for a lifted model (its lift place goes up) and [{ id, pose }] for the others.
export function planRises(models, poses, rests) {
  return models.flatMap((m) => {
    const rest = rests[m.id]
    if (rest) return samePlace(rest, m.pose) ? [{ id: m.id, delta: m.delta }] : []
    const same = m.lifted ? samePlace(poses[m.id], m.pose) : samePose(poses[m.id], m.pose)
    return same ? [{ id: m.id, pose: { ...m.pose, y: round(m.pose.y + m.delta) } }] : []
  })
}
