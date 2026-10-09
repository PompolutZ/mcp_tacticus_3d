// The gesture of every drag: a left press, a click or a drag, the window listeners of this pointer,
// the camera controls off during the press. What moves and what a drop does stay with the piece.
// No imports: node tests pass fakes for the window, the canvas and the controls.

// Pixels the pointer must move before a press is a drag
export const DRAG_THRESHOLD = 4

// event: the pointerdown (an R3F event or a DOM event). Returns { cancel }, or null when nothing
// started (another button, or canStart said no at the press).
// options:
// - onStart(ev): the drag begins (once). ev: the pointermove past the threshold, or the press.
// - onMove(ev): each pointermove of a drag, the first one too. Return true to end the drag there:
//   onEnd runs at once and the release does nothing more.
// - onEnd(ev): the release of a drag (the drop).
// - onClick(ev): the release of a press that did not become a drag.
// - onCancel(): cancel() ended a drag or a press. No drop.
// - canStart(ev): called at the press when immediate, else at each move past the threshold.
//   False: no drag yet (a piece that must be selected first).
// - immediate: the press is a drag at once, with no threshold and no click.
// - threshold: pixels, DRAG_THRESHOLD by default.
// - button: the button that drags, 0 by default. null: any button.
// - releaseCapture: release the pointer capture of the canvas, true by default.
// - preventDefault: call preventDefault on the press (DOM events of the HUD), false by default.
// - key, ownership: the piece key and the ownership (net/ownership.js). The drag claims key when it starts
//   (at the press when immediate). A refused claim: no drag and no other callback, only onRefused. During the drag, a lost
//   tie for key calls cancel(). Without both, the drag claims nothing (tools, new tokens).
// - onRefused(): the claim was refused. For a piece that set up state at the press.
// - releaseAtEnd: release key after onEnd returned, and after onCancel, true by default. False: the piece
//   releases its claim later (a model, when its body is at rest).
// - controls: the camera controls, off from the press to the end.
// - canvas, window: where capture is released and where the listeners go. Tests pass fakes.
export function startPointerDrag(event, options = {}) {
  const {
    onStart,
    onMove,
    onEnd,
    onClick,
    onCancel,
    onRefused,
    canStart,
    immediate = false,
    threshold = DRAG_THRESHOLD,
    button = 0,
    releaseCapture = true,
    preventDefault = false,
    controls = null,
    canvas = null,
    key = null,
    ownership = null,
    releaseAtEnd = true,
  } = options
  // Only the left button moves a piece. A right or middle drag goes to OrbitControls (the camera).
  if (button !== null && event.button !== button) return null
  if (preventDefault) event.preventDefault?.()
  event.stopPropagation?.()
  if (immediate && canStart && !canStart(event)) return null
  const claims = key !== null && key !== undefined && ownership
  if (immediate && claims && !ownership.claim(key)) {
    onRefused?.()
    return null
  }

  const target = options.window ?? window
  const pointerId = event.pointerId ?? event.nativeEvent?.pointerId
  const startX = event.clientX
  const startY = event.clientY
  let dragging = false
  // Over: the drag ended or was cancelled. Moves and the release do nothing then.
  let over = false
  // The listeners are removed and the controls are back on
  let closed = false
  // This drag holds the claim on key. stopLost removes the onLost listener.
  let claimed = Boolean(immediate && claims)
  let stopLost = null

  if (controls) controls.enabled = false
  // A pointerdown on the canvas also starts an OrbitControls drag, which captures the pointer
  if (releaseCapture && pointerId !== undefined && canvas?.hasPointerCapture?.(pointerId)) {
    canvas.releasePointerCapture(pointerId)
  }

  // The end of the drag, after onEnd or onCancel: the listener goes, and the claim with it when asked
  function endClaim() {
    if (!claimed) return
    claimed = false
    stopLost?.()
    stopLost = null
    if (releaseAtEnd) ownership.release(key)
  }

  function listenLost() {
    stopLost = ownership.onLost((lostKey) => {
      if (lostKey === key) cancel()
    })
  }

  function finish() {
    closed = true
    if (controls) controls.enabled = true
    target.removeEventListener('pointermove', handleMove)
    target.removeEventListener('pointerup', handleUp)
  }

  function handleMove(ev) {
    if (ev.pointerId !== pointerId || over) return
    if (!dragging) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < threshold) return
      if (canStart && !canStart(ev)) return
      if (claims) {
        if (!ownership.claim(key)) {
          over = true
          finish()
          onRefused?.()
          return
        }
        claimed = true
        listenLost()
      }
      dragging = true
      onStart?.(ev)
    }
    if (onMove?.(ev)) {
      over = true
      onEnd?.(ev)
      endClaim()
    }
  }

  function handleUp(ev) {
    if (ev.pointerId !== pointerId) return
    try {
      if (over) return
      over = true
      if (dragging) onEnd?.(ev)
      else onClick?.(ev)
    } finally {
      finish()
      endClaim()
    }
  }

  // Ends the drag with no drop. Does nothing after the release.
  function cancel() {
    if (closed) return
    const wasOver = over
    over = true
    finish()
    try {
      if (!wasOver) onCancel?.()
    } finally {
      endClaim()
    }
  }

  target.addEventListener('pointermove', handleMove)
  target.addEventListener('pointerup', handleUp)
  if (immediate) {
    if (claimed) listenLost()
    dragging = true
    onStart?.(event)
  }
  return { cancel }
}
