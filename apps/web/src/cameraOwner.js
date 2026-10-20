// Who moves the camera: the mouse (OrbitControls drag) or the camera keys. The first input wins, the other
// does nothing until the first one ends. Plain module, no React. See docs/features/key-shortcuts.md,
// "One camera input at a time". The wheel is not an owner: it is a single, smoothed step.
export function createCameraOwner() {
  let owner = null // null, 'mouse' or 'keys'
  // Setting "Mouse and keys move camera together": no owner blocks the other input
  let together = false

  return {
    // Switches the mode at any time. A key owner is dropped, so a held key no longer blocks the mouse.
    setTogether(on) {
      together = on
      if (on && owner === 'keys') owner = null
    },
    get owner() {
      return owner
    },
    // A mouse camera drag starts. held: a camera key is held. Returns false when a held key owns the
    // camera (the drag is refused). A glide after the release is not held: the mouse takes over.
    mouseStart(held = true) {
      if (owner === 'keys' && held && !together) return false
      owner = 'mouse'
      return true
    },
    // The mouse button was released, or the drag was lost (blur, release outside the window)
    mouseEnd() {
      if (owner === 'mouse') owner = null
    },
    // Called every frame. active: a camera key is held or the camera still glides. dragging: a piece drag is in progress, then the
    // keys move the camera as always, also during a mouse press. Returns true when the keys move the camera.
    keysMove(active, dragging = false) {
      if (together) return active
      if (!active) {
        if (owner === 'keys') owner = null
        return false
      }
      if (owner === null) owner = 'keys'
      return owner === 'keys' || dragging
    },
    // Nobody owns the camera (window blur)
    release() {
      owner = null
    },
  }
}

// Whether the held keys turn the mouse camera drag off: only in the first-input-wins mode
export function keysBlockMouse(owner, held, together) {
  return !together && owner === 'keys' && held
}

// Turns the mouse camera drag (turn and pan) of OrbitControls on or off. Not `enabled`: the wheel
// (WheelCamera.jsx) reads that.
export function setMouseCamera(controls, on) {
  controls.enableRotate = on
  controls.enablePan = on
}
