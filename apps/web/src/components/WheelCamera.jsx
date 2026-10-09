import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Vector3 } from 'three'
import { CAMERA_FRAME_PRIORITY, panOnTable } from '../camera.js'

// One mouse wheel step zooms by this factor, the same step as OrbitControls (0.95 at zoomSpeed 1).
// The size of the delta is not used: one wheel step is 100 px on Windows and 4 px on a Mac.
// Zoom amounts are the log of the distance factor, so steps add up. Above 0 zooms out.
const WHEEL_ZOOM_STEP = Math.log(1 / 0.95)
// Pinch zoom: one wheel event multiplies the camera distance by e^(deltaY × PINCH_RATE). Picked by look.
const PINCH_RATE = 0.01
// Largest |deltaY| of one zoom event. A pinch sends many small events. Ctrl + one mouse wheel step
// sends one large event (100 px on Windows), and this limit keeps that step at about 10%.
const MAX_ZOOM_DELTA = 10
// A wheel event that comes later than this after the previous one starts a new gesture (ms)
const GESTURE_GAP = 200
// The camera does not jump by a whole wheel event. Each frame it moves 1 − e^(−dt / time) of the zoom
// or pan that is left. So about 63% is done after one smoothing time and 95% after three, at any
// frame rate. Picked by look. A mouse wheel step is large and comes 50–100 ms after the previous one,
// so it gets the longer time. A trackpad sends small steps every frame, and a long time would make the
// view lag behind the fingers.
const WHEEL_SMOOTH_TIME = 0.08
const TRACKPAD_SMOOTH_TIME = 0.03
// When less than this is left, the rest is done in the same frame. Zoom: log of the distance factor.
// Pan: screen pixels.
const ZOOM_DONE = 1e-4
const PAN_DONE = 0.01

const offset = new Vector3()

// A browser reports a mouse wheel and a two-finger swipe on a trackpad as the same wheel event. It
// has no flag for the device. These signs are true for a Mac trackpad and false for a mouse wheel:
// - pixel deltas. Firefox reports a mouse wheel in lines.
// - whole numbers. A Mac mouse wheel step is 4.000244 px or a multiple of it.
// - a sideways part, or a step under 4 px. A mouse wheel step is at least 4 px.
// deltaMode is read first: Firefox reports a mouse wheel in pixels if the deltas are read first.
function looksLikeTrackpad(e) {
  return (
    e.deltaMode === WheelEvent.DOM_DELTA_PIXEL &&
    Number.isInteger(e.deltaX) &&
    Number.isInteger(e.deltaY) &&
    (e.deltaX !== 0 || Math.abs(e.deltaY) < 4)
  )
}

// The part of what is left that one frame of dt seconds does
function framePart(smoothTime, dt) {
  return 1 - Math.exp(-dt / smoothTime)
}

// All wheel input of the camera, smoothed. A mouse wheel zooms, as in TTS. On a trackpad, a
// two-finger swipe pans and a pinch zooms. The browser reports a pinch as a wheel event with ctrlKey
// set (Chrome, Firefox, Safari), so Ctrl + a mouse wheel also zooms. OrbitControls gets no wheel
// event. It still zooms on a touch screen (two-finger pinch).
// ref: { stop() } ends the zoom and pan that are left. App calls it when it moves the camera itself.
export const WheelCamera = forwardRef(function WheelCamera(_, ref) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)
  // The same element that OrbitControls listens on
  const element = useThree((state) => state.events.connected || state.gl.domElement)
  // Zoom and pan that the camera has not done yet. zoomTime: smoothing time of the last zoom input.
  const left = useRef({ zoom: 0, zoomTime: WHEEL_SMOOTH_TIME, panX: 0, panY: 0 })

  function stop() {
    left.current.zoom = 0
    left.current.panX = 0
    left.current.panY = 0
  }

  useImperativeHandle(ref, () => ({ stop }), [])

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
      // OrbitControls does not get the event. The browser does not zoom the page, and it does not
      // go back a page on a sideways swipe.
      e.preventDefault()
      e.stopPropagation()
      // OrbitControls is off during a piece drag. The wheel does nothing then.
      if (!controls.enabled) return
      if (e.ctrlKey)
        addZoom(
          MathUtils.clamp(e.deltaY, -MAX_ZOOM_DELTA, MAX_ZOOM_DELTA) * PINCH_RATE,
          TRACKPAD_SMOOTH_TIME,
        )
      else if (trackpadGesture) addPan(e.deltaX, e.deltaY)
      else if (e.deltaY !== 0) addZoom(Math.sign(e.deltaY) * WHEEL_ZOOM_STEP, WHEEL_SMOOTH_TIME)
    }

    // The zoom that is left stays within the OrbitControls zoom limits. Otherwise zoom input past a
    // limit would add up, and the next zoom the other way would first have to undo it.
    function addZoom(amount, smoothTime) {
      const distance = camera.position.distanceTo(controls.target)
      const m = left.current
      m.zoom = MathUtils.clamp(
        m.zoom + amount,
        Math.log(controls.minDistance / distance),
        Math.log(controls.maxDistance / distance),
      )
      m.zoomTime = smoothTime
    }

    // Screen pixels. They become inches when the frame moves the camera, at the zoom of that frame.
    function addPan(deltaX, deltaY) {
      left.current.panX += deltaX
      left.current.panY += deltaY
    }

    // Capture phase: this listener runs before the OrbitControls listener on the same element
    element.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => element.removeEventListener('wheel', onWheel, { capture: true })
  }, [camera, controls, element])

  useFrame((_, dt) => {
    if (!controls) return
    // The view stays still under a dragged piece
    if (!controls.enabled) {
      stop()
      return
    }
    const m = left.current
    if (m.zoom !== 0) {
      const part = framePart(m.zoomTime, dt)
      const step = Math.abs(m.zoom * (1 - part)) < ZOOM_DONE ? m.zoom : m.zoom * part
      m.zoom -= step
      zoom(step)
    }
    if (m.panX !== 0 || m.panY !== 0) {
      const part = framePart(TRACKPAD_SMOOTH_TIME, dt)
      const done = Math.hypot(m.panX, m.panY) * (1 - part) < PAN_DONE
      const x = done ? m.panX : m.panX * part
      const y = done ? m.panY : m.panY * part
      m.panX -= x
      m.panY -= y
      pan(x, y)
    }
  }, CAMERA_FRAME_PRIORITY)

  // The table moves about as far as the fingers: the deltas are screen pixels, and this is the
  // size of one pixel at the orbit target. The direction is the same as when the swipe scrolls a
  // page. deltaY > 0 shows more of what is below the view.
  function pan(deltaX, deltaY) {
    const distance = camera.position.distanceTo(controls.target)
    const inchesPerPixel =
      (2 * distance * Math.tan(MathUtils.degToRad(camera.fov / 2))) / element.clientHeight
    panOnTable(camera, controls.target, deltaX * inchesPerPixel, -deltaY * inchesPerPixel)
  }

  // Moves the camera toward the orbit target or away from it, within the OrbitControls zoom limits.
  // amount: log of the distance factor.
  function zoom(amount) {
    offset.copy(camera.position).sub(controls.target)
    offset.setLength(
      MathUtils.clamp(
        offset.length() * Math.exp(amount),
        controls.minDistance,
        controls.maxDistance,
      ),
    )
    camera.position.copy(controls.target).add(offset)
  }

  return null
})
