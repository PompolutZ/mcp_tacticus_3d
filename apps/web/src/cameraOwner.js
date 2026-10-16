// Who moves the camera: the mouse (OrbitControls drag) or the camera keys. The first input wins, the other
// does nothing until the first one ends. Plain module, no React. See docs/features/key-shortcuts.md,
// "One camera input at a time". The wheel is not an owner: it is a single, smoothed step.
export function createCameraOwner() {
  let owner = null // null, 'mouse' or 'keys'

  return {
    get owner() {
      return owner
    },
    // A mouse camera drag starts. Returns false when the keys own the camera (the drag is refused).
    mouseStart() {
      if (owner === 'keys') return false
      owner = 'mouse'
      return true
    },
    // The mouse button was released, or the drag was lost (blur, release outside the window)
    mouseEnd() {
      if (owner === 'mouse') owner = null
    },
    // Called every frame. held: a camera key is held. dragging: a piece drag is in progress, then the
    // keys move the camera as always, also during a mouse press. Returns true when the keys move the camera.
    keysMove(held, dragging = false) {
      if (!held) {
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

// Turns the mouse camera drag (turn and pan) of OrbitControls on or off. Not `enabled`: the wheel
// (WheelCamera.jsx) reads that.
export function setMouseCamera(controls, on) {
  controls.enableRotate = on
  controls.enablePan = on
}
