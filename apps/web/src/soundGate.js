// Plain rules of the bump sounds (docs/features/sounds.md). No audio, so node tests can run them.

// One piece plays at most one bump in this time
export const KEY_GAP_MS = 60
// All bumps together play at most CAP_COUNT sounds in CAP_MS (5 dice bump at the same time)
export const CAP_COUNT = 6
export const CAP_MS = 100

// allow(key, now) is true when a bump may play, and then it counts as played. now: ms.
export function createBumpGate() {
  const lastByKey = new Map()
  let recent = []
  return function allow(key, now) {
    if (now - (lastByKey.get(key) ?? -Infinity) < KEY_GAP_MS) return false
    recent = recent.filter((time) => now - time < CAP_MS)
    if (recent.length >= CAP_COUNT) return false
    lastByKey.set(key, now)
    recent.push(now)
    return true
  }
}
