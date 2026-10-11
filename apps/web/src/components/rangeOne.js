// Place 1 lock of the R1 tool (README "Range 1"): while it is on, the center of the dragged character
// stays on the line through the snapped piece's center c, from c out to full range 1.

// Below this center distance the direction from c is not known, so the last one is kept
const MIN_DIST = 0.01

// Drag point p (table XZ) held to the line. reach: the most the centers can be apart (the snapped
// radius + the tool width + the character radius). lastDir: unit { x, z }, the direction to keep near
// c. Returns { x, z, dir }, dir = the unit direction of the result from c.
export function lockPoint(c, p, reach, lastDir) {
  const dx = p.x - c.x,
    dz = p.z - c.z
  const d = Math.hypot(dx, dz)
  const dir = d < MIN_DIST ? lastDir : { x: dx / d, z: dz / d }
  const len = Math.min(d, reach)
  return { x: c.x + dir.x * len, z: c.z + dir.z * len, dir }
}

// Tool yaw for which the short-side line through c points along unit dir. across: the long side
// (±1, local ±Z) that the snapped base touches. The character is on the other long side, so the
// line is local -across·Z, and local +Z is (sin yaw, cos yaw) on the table.
export function lockYaw(dir, across) {
  return Math.atan2(-across * dir.x, -across * dir.z)
}
