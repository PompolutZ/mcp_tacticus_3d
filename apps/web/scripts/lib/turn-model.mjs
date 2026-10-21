// Turns a model around the vertical line through its origin (the base center), and keeps the sum of the
// turns in the command of the file, for turn-model.mjs.
// Plain module: it needs only a glTF-Transform document and strings, so a test can build them in memory.
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

// The turn-model part of the command of character `key` in src/characters/custom-models.json:
// ` && pnpm --filter web turn-model <key> <sum>`
const turnPart = (key) =>
  new RegExp(` && pnpm --filter web turn-model ${escapeRegExp(key)} (-?[0-9.]+)`)
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The sum of the turns that the command of a character already has (0 when none), in degrees
export function turnSumOf(command, key) {
  const match = command.match(turnPart(key))
  return match ? Number(match[1]) : 0
}

// The command with `degrees` added to its turn part. The sum is in -180..180. A sum of 0 removes the
// turn part: the file is then as the first command made it, and the record has no turn.
export function withTurn(command, key, degrees) {
  const sum = normalizeAngle(turnSumOf(command, key) + degrees)
  const bare = command.replace(turnPart(key), '')
  return sum === 0 ? bare : `${bare} && pnpm --filter web turn-model ${key} ${sum}`
}
