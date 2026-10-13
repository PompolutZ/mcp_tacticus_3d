// Place 1 lock of the R1 tool (docs/features/range-movement-tools.md, "Range 1"): while it is on, the
// base edge of the dragged character stays within range 1 of the snapped piece edge, seen from above.

// Most that the centers can be apart: the snapped radius + range + the character radius
export function rangeReach(snappedRadius, range, radius) {
  return snappedRadius + range + radius
}

// The base is within range 1 (eps: a base that sits exactly at range 1 counts)
export function withinRange(c, p, reach, eps = 0.01) {
  return Math.hypot(p.x - c.x, p.z - c.z) <= reach + eps
}

// Drag point p (table XZ) kept within reach of the snapped center c: p itself, or the point on the
// line from c to p at full reach. A base can cover the center of the snapped piece.
export function clampRange(c, p, reach) {
  const d = Math.hypot(p.x - c.x, p.z - c.z)
  if (d <= reach) return { x: p.x, z: p.z }
  return { x: c.x + ((p.x - c.x) * reach) / d, z: c.z + ((p.z - c.z) * reach) / d }
}
