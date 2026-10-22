// The rows of the crisis strip (CrisisStrip.jsx, docs/features/spectator-view.md, "Crisis strip"). No imports, so a
// Node test can run it.
// The setup steps before the crisis cards lie on the board ends (setup/setup.js, setupStep). The cards of the
// steps show on the table then, so the strip stays away.
const SETUP_STEPS = ['rollOff', 'deck', 'first', 'second', 'threat', 'edge']
const TYPES = [
  { type: 'secure', label: 'Secure' },
  { type: 'extract', label: 'Extract' },
]

// crisis: { secure, extract } card keys of the table (null for none). step: the setup step of a room, or null
// in the Sandbox (it has no setup steps). nameOf(key): the card name. Returns [{ type, label, key, name }],
// Secure first; [] while a setup step runs or when nothing is in play.
export function crisisStripItems(crisis, step, nameOf) {
  if (step && SETUP_STEPS.includes(step)) return []
  return TYPES.filter(({ type }) => crisis?.[type]).map(({ type, label }) => ({
    type,
    label,
    key: crisis[type],
    name: nameOf(crisis[type]) ?? crisis[type],
  }))
}

// Does the scoreboard fit at the center of the top bar? center, width: the x of the bar center and the width
// the scoreboard needs (its own max-content width, not where it is now, so the answer does not depend on the
// row it sits in). obstacles: [{ left, right }] the boxes of the bar (room box, Setup, table tools, panel
// buttons). gap: the room kept free on each side.
export function scoreboardFits(center, width, obstacles, gap = 0) {
  const left = center - width / 2 - gap
  const right = center + width / 2 + gap
  return obstacles.every((box) => box.right <= left || box.left >= right)
}
