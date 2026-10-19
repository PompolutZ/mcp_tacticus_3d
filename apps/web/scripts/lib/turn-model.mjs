// Turns a model around the vertical line through its origin (the base center), for turn-model.mjs.
// Plain module: it needs only a glTF-Transform document, so a test can build one in memory.
// See docs/features/custom-models.md, "Front".

// Turns every root node of every scene around Y by `degrees`. Positive is counterclockwise seen from
// above (right-handed, Y up). The origin stays where it is, so the base center stays at the origin.
export function turnRoots(doc, degrees) {
  const half = (degrees * Math.PI) / 360
  const [ay, aw] = [Math.sin(half), Math.cos(half)]
  const [sin, cos] = [Math.sin(2 * half), Math.cos(2 * half)]
  for (const scene of doc.getRoot().listScenes()) {
    for (const node of scene.listChildren()) {
      const [x, y, z] = node.getTranslation()
      node.setTranslation([x * cos + z * sin, y, -x * sin + z * cos])
      // New rotation = turn (0, ay, 0, aw) times the old rotation
      const [bx, by, bz, bw] = node.getRotation()
      node.setRotation([aw * bx + ay * bz, aw * by + ay * bw, aw * bz - ay * bx, aw * bw - ay * by])
    }
  }
}

// An angle in degrees as the same turn in -180..180 (180 stays 180)
export function normalizeAngle(degrees) {
  let a = ((degrees % 360) + 360) % 360
  if (a > 180) a -= 360
  return Math.round(a * 1e6) / 1e6
}
