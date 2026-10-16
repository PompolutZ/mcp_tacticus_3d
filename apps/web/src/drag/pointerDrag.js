// The gesture of every drag: a left press, a click or a drag, the window listeners of this pointer,
// the camera controls off during the press. What moves and what a drop does stay with the piece.
// No imports: node tests pass fakes for the window, the canvas and the controls.

// Pixels the pointer must move before a press is a drag
export const DRAG_THRESHOLD = 4

// The drag that is in progress, from the press to the release or the cancel. One pointer drags at a
// time. Esc reaches it through cancelActiveDrag, so no piece keeps its own handle for the key.
let activeDrag = null

// True while a pointer drag is in progress
export function isDragActive() {
  return activeDrag !== null
}

// Ends the drag in progress with no drop (its onCancel runs). Returns true when there was one.
export function cancelActiveDrag() {
  if (!activeDrag) return false
  activeDrag.cancel()
  return true
}

// Callbacks of things that follow the pointer without a drag of their own (the ghost of a token or tool drag,
// usePointerTablePoint). They run in refreshActiveDrag.
const refreshListeners = new Set()

// Subscribes fn to refreshActiveDrag. Returns the unsubscribe function.
export function onDragRefresh(fn) {
  refreshListeners.add(fn)
  return () => refreshListeners.delete(fn)
}

// The camera moved while the pointer stood still, so the point under the pointer changed. Runs onMove of the drag
// in progress again with its last pointer event (only after the drag started), and the refresh listeners.
// KeyboardCamera calls it after each frame that moved the camera. Each onMove only sets the pose from the pointer
// position, so a second run with the same event has no other effect.
export function refreshActiveDrag() {
  activeDrag?.refresh()
  for (const fn of refreshListeners) fn()
}

// True for a DOM event of an element that is not the canvas. An R3F event has nativeEvent.
function isHudEvent(event) {
  return !event.nativeEvent && event.target?.tagName !== 'CANVAS'
}

// event: the pointerdown (an R3F event or a DOM event). Returns { cancel }, or null when nothing
// started (another button, or canStart said no at the press).
// options:
// - onStart(ev): the drag begins (once). ev: the pointermove past the threshold, or the press.
// - onMove(ev): each pointermove of a drag, the first one too. Return true to end the drag there:
//   onEnd runs at once and the release does nothing more.
// - onEnd(ev): the release of a drag (the drop).
// - onClick(ev): the release of a press that did not become a drag.
// - onCancel(reason): cancel() ended a drag or a press. No drop. reason: 'cancel' (Esc, cancelActiveDrag), or
//   'lost' (a lost tie for key: the other player owns the piece now, so it must not be put back).
// - canStart(ev): called at the press when immediate, else at each move past the threshold.
//   False: no drag yet (a piece that cannot move now: a token that cannot move, a tool with no body).
// - immediate: the press is a drag at once, with no threshold and no click.
// - threshold: pixels, DRAG_THRESHOLD by default.
// - button: the button that drags, 0 by default. null: any button.
// - releaseCapture: release the pointer capture of the canvas, true by default.
// - preventDefault: call preventDefault on the press (DOM events of the HUD), false by default. Only a DOM event
//   of an element other than the canvas gets it: R3F listens to the canvas as passive, so it does nothing there and
//   the browser logs a warning.
// - key, ownership: the piece key and the ownership (net/ownership.js). The drag claims key when it starts
//   (at the press when immediate). A refused claim: no drag and no other callback, only onRefused. During the drag, a lost
//   tie for key calls cancel(). Without both, the drag claims nothing (tools, new tokens).
// - onRefused(): the claim was refused. For a piece that set up state at the press.
// - releaseAtEnd: release key after onEnd returned, and after onCancel, true by default. False: the piece
//   releases its claim later (a model, when its body is at rest).
// - live, livePose: the live poses of pieces without a body (docs/features/peer-to-peer.md, "Pose message"). live: a Map, piece key →
//   getter, which LiveSync reads at each send. livePose(): the pose of the piece ({ x, z, yaw? }), or null.
//   The getter is in the Map from the claim to the end of the drag. Needs key and ownership.
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
    live = null,
    livePose = null,
  } = options
  // Only the left button moves a piece. A right or middle drag goes to OrbitControls (the camera).
  if (button !== null && event.button !== button) return null
  if (preventDefault && isHudEvent(event)) event.preventDefault?.()
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
  // The last pointermove that reached the drag, for refreshActiveDrag
  let lastMove = null

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
    if (live && livePose && live.get(key) === livePose) live.delete(key)
    if (releaseAtEnd) ownership.release(key)
  }

  // The claim is held: the live pose of the piece goes to LiveSync, and a lost tie cancels the drag
  function startClaim() {
    if (live && livePose) live.set(key, livePose)
    listenLost()
  }

  function listenLost() {
    stopLost = ownership.onLost((lostKey) => {
      if (lostKey === key) cancel('lost')
    })
  }

  function finish() {
    closed = true
    if (activeDrag === handle) activeDrag = null
    if (controls) controls.enabled = true
    target.removeEventListener('pointermove', handleMove)
    target.removeEventListener('pointerup', handleUp)
  }

  function handleMove(ev) {
    if (ev.pointerId !== pointerId || over) return
    lastMove = ev
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
        startClaim()
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
  function cancel(reason = 'cancel') {
    if (closed) return
    const wasOver = over
    over = true
    finish()
    try {
      if (!wasOver) onCancel?.(reason)
    } finally {
      endClaim()
    }
  }

  // Runs the move again at the last pointer place, once the drag started
  function refresh() {
    if (dragging && !over && lastMove) handleMove(lastMove)
  }

  const handle = { cancel, refresh }
  activeDrag = handle
  target.addEventListener('pointermove', handleMove)
  target.addEventListener('pointerup', handleUp)
  if (immediate) {
    if (claimed) startClaim()
    dragging = true
    lastMove = event
    onStart?.(event)
  }
  return handle
}
