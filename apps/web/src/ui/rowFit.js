// Row size of the Streamer columns (SpectatorColumns.jsx, docs/features/spectator-view.md, "Squad columns").
// Rows have one fixed height. When the rows do not fit the free height of the column, they all scale down
// by the same factor; below MIN_SCALE they stop and the list is clipped (the columns ignore the pointer, so no scroll).

// Height of a row in px at 100% column size and scale 1 (streamer.css, --row-h uses the same number)
export const ROW_HEIGHT = 58
// The smallest scale of a row; below it the text is too small to read
export const MIN_SCALE = 0.6

// available: free height (px) for the list. count: rows. rowHeight: row height (px) at scale 1.
// Returns the scale (MIN_SCALE..1).
export function fitRows({ available, count, rowHeight, minScale = MIN_SCALE }) {
  if (count <= 0 || !(rowHeight > 0) || !Number.isFinite(available)) {
    return { scale: 1 }
  }
  const wanted = Math.floor((available / (count * rowHeight)) * 1000) / 1000
  if (!(wanted >= minScale)) return { scale: minScale }
  return { scale: Math.min(1, wanted) }
}
