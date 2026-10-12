// The tool entry of the table document (net/doc.js, `tools.<side>.<kind>`). Plain module: no three.js.
// docs/plans/implement-backend/09-moving-objects.md, decisions 10 and 12.
//
// Entry: { which, spawn, at?, pose?, turn?, snap?, mode? }
// - which: the range number, the movement type, or true for the angle tool
// - spawn: a random id, new at each spawn, so the tool mounts again
// - at: { x, z }, the point of a free spawn
// - pose: { x, y, z, yaw }. turn: { right, left }. snap: { kind, id, side, across? } | null.
//   mode: 'away' | 'toward'

// Positions to 3 decimals (0.001"), yaw and bend to 4 decimals, as the live packets (plan, "Names")
const round3 = (v) => Math.round(v * 1e3) / 1e3
const round4 = (v) => Math.round(v * 1e4) / 1e4

function roundPoint({ x, z }) {
  return { x: round3(x), z: round3(z) }
}

// pose: { x, y, z, yaw } with any decimals
export function roundPose({ x, y, z, yaw }) {
  return { x: round3(x), y: round3(y), z: round3(z), yaw: round4(yaw) }
}

export function roundTurn({ right, left }) {
  return { right: round4(right), left: round4(left) }
}

// A snap { kind, id, side, across? } or null. A missing across stays missing.
function storedSnap(snap) {
  if (!snap) return null
  const { kind, id, side, across } = snap
  return across === undefined ? { kind, id, side } : { kind, id, side, across }
}

// The stored fields from the live values of a tool. snap: { kind, id, side, across? } | null.
export function storedFields({ pose, turn, snap, mode }) {
  return { pose: roundPose(pose), turn: roundTurn(turn), snap: storedSnap(snap), mode }
}

function samePair(a, b, keys) {
  return keys.every((key) => a[key] === b[key])
}

// True when the stored fields of a and b are equal. b may be an entry with missing fields.
export function sameStored(a, b) {
  if (!a.pose || !b.pose || !a.turn || !b.turn) return false
  if (!samePair(a.pose, b.pose, ['x', 'y', 'z', 'yaw'])) return false
  if (!samePair(a.turn, b.turn, ['right', 'left'])) return false
  if (a.mode !== b.mode) return false
  if (!a.snap || !b.snap) return !a.snap && !b.snap
  return samePair(a.snap, b.snap, ['kind', 'id', 'side', 'across'])
}

// The yaw of a free spawn. Blue's tools have yaw 0. Red's have Blue + π, so the buttons read from
// Red's side (decision 12).
export function freeSpawnYaw(side) {
  return side === 'guest' ? Math.PI : 0
}

// A new random id for `spawn`. random: a function that gives a number in [0, 1), for tests.
export function newSpawnId(random = Math.random) {
  return Math.floor(random() * 36 ** 8)
    .toString(36)
    .padStart(8, '0')
}

// A new entry for a spawn. at: { x, z } for a free spawn, null to snap to a piece. It has no pose,
// so a spawn replaces an old entry whole.
export function spawnEntry(which, at, random) {
  const entry = { which, spawn: newSpawnId(random) }
  return at ? { ...entry, at: roundPoint(at) } : entry
}
