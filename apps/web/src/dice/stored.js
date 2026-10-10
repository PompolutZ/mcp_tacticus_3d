// The dice of a tray as the table document stores them (docs/plans/implement-backend/10-dice.md,
// "Names"). Plain module, no React and no scene, so node --test can load it.
//
// Die entry: { order, place, face?, pose? }. place: 'air' | 'well' | 'shelf'. face: 1 to 8, only on
// the shelf. pose: { x, y, z, qx, qy, qz, qw }, only in the air and the well.

import { FACES, SYMBOLS } from './faces.js'

// 8 hex characters of a UUID: short, because each live packet of a flight carries the id.
// taken: anything with has(id), the ids the tray has. A new id if the tray has this one.
export function dieId(taken) {
  let id
  do id = crypto.randomUUID().slice(0, 8)
  while (taken.has(id))
  return id
}

const round = (v, decimals) => Math.round(v * 10 ** decimals) / 10 ** decimals

// The stored pose of a body: position t { x, y, z } with 3 decimals, rotation r { x, y, z, w } with 4.
// null when a number is not finite, so a broken pose is never written.
export function roundPose(t, r) {
  const values = [t.x, t.y, t.z, r.x, r.y, r.z, r.w]
  if (!values.every(Number.isFinite)) return null
  return {
    x: round(t.x, 3),
    y: round(t.y, 3),
    z: round(t.z, 3),
    qx: round(r.x, 4),
    qy: round(r.y, 4),
    qz: round(r.z, 4),
    qw: round(r.w, 4),
  }
}

// The entry of a die. face: only used on the shelf. pose: only used in the air and the well.
export function dieEntry(order, place, { face, pose } = {}) {
  if (place === 'shelf') return { order, place, face }
  return pose ? { order, place, pose } : { order, place }
}

// The order of the next die: one above the highest one in the tray
export function nextOrder(entries) {
  let max = 0
  for (const entry of entries) if (entry.order > max) max = entry.order
  return max + 1
}

// What the keys of a tray show, from the stored entries (an object by id, or an array) and
// critsUsed: { well, shelf, critsAvailable }. well: dice not on the shelf. shelf: every symbol,
// 0 when none.
export function trayCounts(entries, critsUsed) {
  const shelf = Object.fromEntries(SYMBOLS.map((symbol) => [symbol, 0]))
  let well = 0
  for (const entry of Object.values(entries ?? {})) {
    if (entry.place !== 'shelf') well++
    else if (FACES[entry.face - 1]) shelf[FACES[entry.face - 1].symbol]++
  }
  return { well, shelf, critsAvailable: critsUsed ? 0 : shelf.crit }
}
