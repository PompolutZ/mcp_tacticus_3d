import { useCallback, useRef } from 'react'
import { setDynamic, setKinematic } from '../physics.js'
import { HOVER_RATE } from '../pieces/heights.js'
import { upright } from '../characters/base.js'

const ZERO = { x: 0, y: 0, z: 0 }

// The slide of a model (Advance, docs/features/range-movement-tools.md). Its functions are used by the
// frame, the drag and the Advance handle of CharacterFigure. It has no effect.
// liveRb(): the body or null. isDragging, remoteRef: refs of CharacterFigure. clearLift(), clearRest():
// forget the lift and the pose the settle timer watches (a hook must not write to a ref it gets as an
// argument).
export function useModelSlide({ liveRb, isDragging, remoteRef, clearLift, clearRest }) {
  // The slide: { path, duration, time }, or null
  const slide = useRef(null)

  // Moves the model along path in duration seconds. path(f) is the body position at the share f (0..1) of
  // the slide, with y null when nothing is under it (slidePath in throwPath.js). The body is kinematic
  // during the slide, so physics does not move it. A slide ends a lift, and a drag ends a slide. The
  // caller claims the model and counts the move.
  function startSlide(path, duration) {
    const rb = liveRb()
    if (!rb || isDragging.current || remoteRef.current) return
    clearLift()
    clearRest()
    setKinematic(rb)
    slide.current = { path, duration, time: 0 }
  }

  // Moves a sliding model one frame. It stands upright, as during a drag. Its height follows the path,
  // smoothed the same way as during a drag, so a model that leaves a roof drops quickly but not at
  // once. At the end the model stands at the last point of the path, and physics moves it again.
  function moveSlide(rb, dt) {
    const s = slide.current
    const t = rb.translation()
    s.time += dt
    if (s.time >= s.duration) {
      const end = s.path(1)
      slide.current = null
      setDynamic(rb)
      rb.setTranslation({ x: end.x, y: end.y ?? t.y, z: end.z }, true)
      rb.setRotation(upright(rb.rotation()), true)
      rb.setLinvel(ZERO, true)
      rb.setAngvel(ZERO, true)
      return
    }
    const p = s.path(s.time / s.duration)
    const y = p.y === null ? t.y : t.y + (p.y - t.y) * Math.min(1, dt * HOVER_RATE)
    // A sleeping body keeps moving but its mesh is not synced, so keep it awake
    rb.wakeUp()
    rb.setNextKinematicTranslation({ x: p.x, y, z: p.z })
    rb.setNextKinematicRotation(upright(rb.rotation()))
  }

  // Ends the slide without a move (a drag or the remote mode takes the body)
  const clearSlide = useCallback(() => {
    slide.current = null
  }, [])

  const isSliding = () => slide.current !== null

  return { startSlide, moveSlide, clearSlide, isSliding }
}
