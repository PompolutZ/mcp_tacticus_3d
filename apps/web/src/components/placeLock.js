// Footprint geometry of a range or movement tool, on the table (XZ). A footprint is a rectangle for each
// half and the round hinge between them. shape: { x, z, right, left }, the tool center and the yaw of
// each half (toolShape in RulerTool.jsx).
const SIDES = ['right', 'left']
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// World XZ → local XZ of a pose (inverse of the yaw rotation)
export function toLocal(pose, p) {
  const dx = p.x - pose.x,
    dz = p.z - pose.z
  const c = Math.cos(pose.yaw),
    s = Math.sin(pose.yaw)
  return { x: dx * c - dz * s, z: dx * s + dz * c }
}

// Local XZ of a pose → world XZ (inverse of toLocal)
export function fromLocal(pose, l) {
  const c = Math.cos(pose.yaw),
    s = Math.sin(pose.yaw)
  return { x: pose.x + l.x * c + l.z * s, z: pose.z - l.x * s + l.z * c }
}

// Edge-to-edge gap between a round base and the footprint: a rectangle for each half and the
// round hinge between them. The ends stay flat (not a capsule). Gap ≤ 0 means the base touches it.
export function footprintGap(shape, length, halfWidth, center, radius) {
  let gap = Math.hypot(center.x - shape.x, center.z - shape.z) - halfWidth
  for (const side of SIDES) {
    const l = toLocal({ x: shape.x, z: shape.z, yaw: shape[side] }, center)
    const ox = l.x - clamp(l.x, 0, length)
    const oz = l.z - clamp(l.z, -halfWidth, halfWidth)
    gap = Math.min(gap, Math.hypot(ox, oz))
  }
  return gap - radius
}

// Nearest point to p where a round base with its center there touches the footprint (gap ≤ 0 in
// footprintGap). p itself when the base already touches it. Each piece of the footprint, grown by the
// radius, is convex, so the nearest point is the nearest of the nearest points on each piece.
export function nearestTouching(shape, length, halfWidth, p, radius) {
  // The round hinge
  const reach = halfWidth + radius
  const d = Math.hypot(p.x - shape.x, p.z - shape.z)
  if (d <= reach) return p
  let best = {
    x: shape.x + ((p.x - shape.x) * reach) / d,
    z: shape.z + ((p.z - shape.z) * reach) / d,
  }
  let bestGap = d - reach
  // The rectangle of each half
  for (const side of SIDES) {
    const pose = { x: shape.x, z: shape.z, yaw: shape[side] }
    const l = toLocal(pose, p)
    const q = {
      x: clamp(l.x, 0, length),
      z: clamp(l.z, -halfWidth, halfWidth),
    }
    const out = Math.hypot(l.x - q.x, l.z - q.z)
    if (out <= radius) return p
    if (out - radius < bestGap) {
      bestGap = out - radius
      best = fromLocal(pose, {
        x: q.x + ((l.x - q.x) * radius) / out,
        z: q.z + ((l.z - q.z) * radius) / out,
      })
    }
  }
  return best
}

// Place lock: the base touches the footprint when its gap is within eps.
export function touches(shape, length, halfWidth, center, radius, eps = 0.01) {
  return footprintGap(shape, length, halfWidth, center, radius) <= eps
}

// The drag point p of a base, cut to where the base touches the footprint. p itself when it does.
export function placeClamp(shape, length, halfWidth, p, radius) {
  return nearestTouching(shape, length, halfWidth, p, radius)
}

// The drag point p cut to the line from start along dir (unit XZ), between 0 and length from start.
export function lineClamp(start, dir, length, p) {
  const d = clamp((p.x - start.x) * dir.x + (p.z - start.z) * dir.z, 0, Math.max(0, length))
  return { x: start.x + dir.x * d, z: start.z + dir.z * d }
}
