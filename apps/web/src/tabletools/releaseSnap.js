// When a free tool snaps to a model: only at the release of a move drag, never while the drag goes on
// (docs/features/range-movement-tools.md, "Snapped"). Plain module, no React.

// Tracks the model under the pointer during one move drag.
// move(model): each pointer move, with the model under the pointer or null.
// release(): the model to snap to at the release, or null. Null also when the drag started on a model and the
// pointer never left it, so a small nudge of a tool that lies over a model does not snap it.
export function createReleaseSnap() {
  let started = false
  let startModel = null
  let over = null
  let left = false
  return {
    move(model) {
      if (!started) {
        started = true
        startModel = model
      } else if (startModel && model !== startModel) {
        left = true
      }
      over = model
    },
    release() {
      if (!started || !over) return null
      if (startModel && !left && over === startModel) return null
      return over
    },
  }
}
