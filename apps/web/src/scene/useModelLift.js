import { useRef } from 'react'
import { setDynamic, setKinematic } from '../physics.js'

// The R key lifts a model straight up by LIFT_HEIGHT (inches), and a second press puts it back at the
// same place. So a player can see and select a token under it, and a Throw or Push can move a model
// under it (docs/features/range-movement-tools.md, "Throw / Push"). The tallest model measured, Sentinel Prime MK4 (5.28", on
// 2026-10-06), fits under a lifted model. Onslaught was not in the TTS cache, so it is not measured.
// From the start view (45°), a token under a large base already shows below a model lifted 2".
const LIFT_HEIGHT = 6
// The lift is smoothed the same way as a Q / E turn (Scene.jsx): each frame the model does
// 1 − e^(−dt / time) of the move that is left. When less than LIFT_DONE (inches) is left, the move is done.
const LIFT_SMOOTH_TIME = 0.06
const LIFT_DONE = 0.001
// Something else moved a lifted model (for example Place, see RulerTool.jsx) when its x or z is this
// far (inches) from the place of the lift
const LIFT_MOVED = 0.001
const ZERO = { x: 0, y: 0, z: 0 }

// The lift of a model (R key). Its refs and functions are used by the frame, the drag and the lift handle
// of CharacterFigure. It has no effect.
// liveRb(): the body or null. groundY(x, z): the ground under the base. isDragging, remoteRef: refs of
// CharacterFigure. clearRest(): forgets the pose the settle timer watches (a hook must not write to a ref it
// gets as an argument).
export function useModelLift({ liveRb, groundY, isDragging, remoteRef, clearRest }) {
  // The lift (R key): { x, y, z, sleeping, up, landing }, or null. x, y, z: the body position before
  // the lift. The model goes back there exactly. sleeping: the body was asleep then. up: the model
  // goes up (true) or back down (false). landing: the model is back at x, y, z, and becomes a
  // dynamic body again in the next frame.
  const lift = useRef(null)

  // R: lifts the model, or puts it back down if it is up. During a drag it does nothing.
  // The body is kinematic during the lift, so physics does not move it: it does not fall, and
  // nothing pushes it.
  function toggleLift() {
    const rb = liveRb()
    if (!rb || isDragging.current || remoteRef.current) return
    if (lift.current) {
      lift.current.up = !lift.current.up
      lift.current.landing = false
      return
    }
    const t = rb.translation()
    lift.current = { x: t.x, y: t.y, z: t.z, sleeping: rb.isSleeping(), up: true, landing: false }
    clearRest()
    setKinematic(rb)
  }

  function lowerLift() {
    if (lift.current) lift.current.up = false
  }

  function endLift(rb) {
    lift.current = null
    setDynamic(rb)
    rb.setLinvel(ZERO, true)
    rb.setAngvel(ZERO, true)
  }

  // Moves a lifted model one frame up or down. The heading stays as it is now, so a Q / E turn
  // during the lift stays after it. Back down, the model is at the same place as before the lift,
  // and a model that was asleep sleeps again. So physics does not move it from that place.
  function moveLift(rb, dt) {
    const from = lift.current
    const t = rb.translation()
    if (Math.abs(t.x - from.x) > LIFT_MOVED || Math.abs(t.z - from.z) > LIFT_MOVED) {
      // Something else moved the model during the lift: Place, or its tray moved and took the model
      // with it (Scene.jsx). The lift ends, and the model stands on the table or terrain there.
      const ground = groundY(t.x, t.z)
      if (ground !== null && t.y > ground) rb.setTranslation({ x: t.x, y: ground, z: t.z }, true)
      endLift(rb)
      return
    }
    const place = { x: from.x, y: from.y, z: from.z }
    if (from.landing) {
      // The kinematic move of the frame before put the body and its mesh at the place. The model
      // sleeps only now, because the mesh of a sleeping body does not follow the body.
      rb.setTranslation(place, true)
      endLift(rb)
      if (from.sleeping) rb.sleep()
      return
    }
    const left = (from.up ? from.y + LIFT_HEIGHT : from.y) - t.y
    if (Math.abs(left) < LIFT_DONE) {
      if (from.up) return
      from.landing = true
      rb.setNextKinematicTranslation(place)
      return
    }
    // A sleeping body keeps moving but its mesh is not synced, so keep it awake
    rb.wakeUp()
    rb.setNextKinematicTranslation({
      ...place,
      y: t.y + left * (1 - Math.exp(-dt / LIFT_SMOOTH_TIME)),
    })
  }

  return { lift, toggleLift, lowerLift, moveLift }
}
