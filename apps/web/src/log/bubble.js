// The Log bubble under the Log button (log/LogPanel.jsx, docs/features/game-log.md, "Panel"). Plain module, no React.

// Closed: how long a new entry shows in the bubble
export const BUBBLE_SHOW_MS = 3000

// Open: how many entries the bubble lists, newest first
export const BUBBLE_ENTRIES = 10

// An entry older than this when it arrives is not new: it came with a sync from the other player
export const FRESH_MS = 5000

// The key of a merged item (log/log.js, mergeLog): one id space for dice and log entries
export const itemKey = (item) => `${item.type}:${item.entry.id}`

// Which item the closed bubble shows now. items: merged, newest first. known: the Set of keys the bubble has
// seen, or null before the first look. Returns { fresh, known }: fresh is the newest item that is not in
// `known` and is at most FRESH_MS old at `now`, or null. The first look (known is null) shows nothing: the
// entries of the open table are not new.
export function freshItem(items, known, now) {
  const next = new Set(items.map(itemKey))
  if (!known) return { fresh: null, known: next }
  const fresh = items.find((item) => !known.has(itemKey(item)) && now - item.entry.at <= FRESH_MS)
  return { fresh: fresh ?? null, known: next }
}
