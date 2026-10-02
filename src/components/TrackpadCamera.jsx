import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { MathUtils, Vector3 } from 'three'
import { panOnTable } from '../camera.js'

// Pinch zoom: one wheel event multiplies the camera distance by e^(deltaY × PINCH_RATE). Picked by look.
const PINCH_RATE = 0.01
// Largest |deltaY| of one zoom event. A pinch sends many small events. Ctrl + one mouse wheel step
// sends one large event (100 px on Windows), and this limit keeps that step at about 10%.
const MAX_ZOOM_DELTA = 10
// A wheel event that comes later than this after the previous one starts a new gesture (ms)
const GESTURE_GAP = 200

const offset = new Vector3()

// A browser reports a mouse wheel and a two-finger swipe on a trackpad as the same wheel event. It
// has no flag for the device. These signs are true for a Mac trackpad and false for a mouse wheel:
// - pixel deltas. Firefox reports a mouse wheel in lines.
// - whole numbers. A Mac mouse wheel step is 4.000244 px or a multiple of it.
// - a sideways part, or a step under 4 px. A mouse wheel step is at least 4 px.
// deltaMode is read first: Firefox reports a mouse wheel in pixels if the deltas are read first.
function looksLikeTrackpad(e) {
  return e.deltaMode === WheelEvent.DOM_DELTA_PIXEL
    && Number.isInteger(e.deltaX) && Number.isInteger(e.deltaY)
    && (e.deltaX !== 0 || Math.abs(e.deltaY) < 4)
}

// Trackpad camera: a two-finger swipe pans, a pinch zooms. A mouse wheel still goes to
// OrbitControls, which zooms, as in TTS. The browser reports a pinch as a wheel event with ctrlKey
// set (Chrome, Firefox, Safari), so Ctrl + a mouse wheel also zooms here.
export function TrackpadCamera() {
  const camera = useThree(state => state.camera)
  const controls = useThree(state => state.controls)
  // The same element that OrbitControls listens on
  const element = useThree(state => state.events.connected || state.gl.domElement)

  useEffect(() => {
    if (!controls || !element) return undefined
    // A swipe can start with a step that does not look like a trackpad. Therefore one trackpad
    // event marks the rest of the gesture, including the slow-down after the fingers lift.
    let trackpadGesture = false
    let lastTime = -Infinity

    function onWheel(e) {
      if (e.timeStamp - lastTime > GESTURE_GAP) trackpadGesture = false
      lastTime = e.timeStamp
      if (!e.ctrlKey && looksLikeTrackpad(e)) trackpadGesture = true
      if (!e.ctrlKey && !trackpadGesture) return
      // OrbitControls does not get the event. The browser does not zoom the page, and it does not
      // go back a page on a sideways swipe.
      e.preventDefault()
      e.stopPropagation()
      // OrbitControls is off during a piece drag. The mouse wheel does nothing then, and so does the trackpad.
      if (!controls.enabled) return
      if (e.ctrlKey) zoom(e.deltaY)
      else pan(e.deltaX, e.deltaY)
    }

    // The table moves about as far as the fingers: the deltas are screen pixels, and this is the
    // size of one pixel at the orbit target. The direction is the same as when the swipe scrolls a
    // page. deltaY > 0 shows more of what is below the view.
    function pan(deltaX, deltaY) {
      const distance = camera.position.distanceTo(controls.target)
      const inchesPerPixel = 2 * distance * Math.tan(MathUtils.degToRad(camera.fov / 2)) / element.clientHeight
      panOnTable(camera, controls.target, deltaX * inchesPerPixel, -deltaY * inchesPerPixel)
    }

    // Moves the camera toward the orbit target or away from it, within the OrbitControls zoom limits.
    // Spreading the fingers gives deltaY < 0 and moves the camera closer.
    function zoom(deltaY) {
      const delta = MathUtils.clamp(deltaY, -MAX_ZOOM_DELTA, MAX_ZOOM_DELTA)
      offset.copy(camera.position).sub(controls.target)
      offset.setLength(MathUtils.clamp(offset.length() * Math.exp(delta * PINCH_RATE), controls.minDistance, controls.maxDistance))
      camera.position.copy(controls.target).add(offset)
    }

    // Capture phase: this listener runs before the OrbitControls listener on the same element
    element.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => element.removeEventListener('wheel', onWheel, { capture: true })
  }, [camera, controls, element])

  return null
}
