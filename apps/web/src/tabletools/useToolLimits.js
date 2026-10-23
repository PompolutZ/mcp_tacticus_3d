import { useRef, useState, useEffect } from 'react'
import { useLatest } from '../scene/useLatest.js'
import { groundedPath, slidePath, throwMove } from '../characters/throwPath.js'
import { endEdgeClamp, lineClamp, placeClamp, touches } from './placeLock.js'
import { clampRange, rangeReach, withinRange } from './rangeOne.js'
import { rangeLength } from './toolTips.js'
import {
  OTHER,
  toolPose,
  toolShape,
  throwLine,
  advancePath,
  sameModel,
  lockKey,
} from './toolGeometry.js'

// Place, Place 1 and Throw of a tool: what they limit during a drag of a model (onPlaceLimit), and their
// buttons' handlers (docs/features/range-movement-tools.md). Takes the state of the tool and gives the state
// of the three modes: { placeSide, placeOne, throwLock, placing, lockOne, throwing, placeButtonSide,
// lockMode, limiting, togglePlace, handlePlaceOne, handleThrow, handleAdvance, clearLimits }. Call it after the effects it must follow
// (see Tool), the order of its effects is part of the behavior.
export function useToolLimits({
  selected,
  snap,
  turn,
  setTurn,
  tip,
  halfWidth,
  angle = false,
  rigidRef,
  liveRb,
  world,
  rapier,
  models,
  onPlaceLimit,
  limitTaken = false,
  onLimitOn,
  // follow(model, p): a range tool turns to aim at the dragged locked piece (Place, Place 1), see Tool
  follow,
}) {
  // While Place is on: the far end at the time Place turned on. The Place button stays there.
  // Off: null. While Place is on, the locked character keeps its base touching the footprint.
  const [placeSide, setPlaceSide] = useState(null)
  const placing = selected && placeSide !== null
  // R1 tool: Place 1 is on. The first character that a drag brings within range 1 of the snapped piece is
  // locked there, until Place 1 turns off. A drag of the snapped piece locks it too, if nothing is locked yet.
  const [placeOne, setPlaceOne] = useState(false)
  const lockOne = selected && placeOne && !!snap
  // The model locked to this tool (`kind:id`), or null before a drag locks one. See ownsDrag below.
  const lockedRef = useRef(null)
  // Place moves the character to the far end, the end that does not touch the snapped base. A free
  // tool has no far end, so Place is shown there only while it is on, so that it can be turned off.
  const placeButtonSide = placeSide ?? (snap ? OTHER[snap.side] : null)
  // While Throw is on: { side, target }, the end the Throw started from and the locked character.
  // The stop point is found again at each clamp. The Throw button stays at that end. Off: null. A drag of the
  // locked character keeps its base center on the middle line of the tool (throwLine), up to the stop point.
  // Place and Throw are never on at the same time: each one hides the other's button.
  const [throwLock, setThrowLock] = useState(null)
  const throwing = selected && throwLock !== null
  // The handlers the effects below call, and the models: read when asked, they do not restart a limit
  const now = useLatest({ models, onPlaceLimit, onLimitOn, rigidRef, world, rapier, follow })

  // Place and Place 1 lock (decision: the first character that touches the outline, or comes within
  // range 1, during a drag). The lock stays until Place turns off. A change of Place / Place 1 clears it.
  const lockMode = placing ? 'place' : lockOne ? 'one' : null
  useEffect(() => {
    lockedRef.current = null
  }, [lockMode])

  // A limit: owns(model, p) says if this tool limits the drag of that model to point p (and locks it the
  // first time), clamp(p) moves p. Both read the tool pose at each call, so the tool can move while on.
  useEffect(() => {
    if (!placing) return undefined
    const { onPlaceLimit, rigidRef } = now.current
    const shape = () => toolShape(toolPose(rigidRef.current), turn)
    onPlaceLimit?.({
      owns(model, p) {
        if (!rigidRef.current) return false
        if (lockedRef.current !== null) return lockedRef.current === lockKey(model)
        const at = model.getCenter()
        if (
          !touches(shape(), tip, halfWidth, p, model.radius) &&
          !(at && touches(shape(), tip, halfWidth, at, model.radius))
        )
          return false
        lockedRef.current = lockKey(model)
        return true
      },
      clamp(p, model) {
        if (!rigidRef.current) return
        // A range tool turns to aim at the piece first, then the piece is cut to the turned outline
        now.current.follow?.(model, p)
        const spot = placeClamp(shape(), tip, halfWidth, p, model.radius)
        p.x = spot.x
        p.z = spot.z
      },
    })
    return () => onPlaceLimit?.(null)
  }, [placing, turn, tip, halfWidth, now])

  // Place 1 (rangeOne.js): the base edge stays within range 1 of the snapped piece edge, seen from above
  useEffect(() => {
    if (!lockOne) return undefined
    const { onPlaceLimit, rigidRef } = now.current
    const { target } = snap
    const reachOf = (model) => rangeReach(target.radius, rangeLength(1), model.radius)
    onPlaceLimit?.({
      owns(model, p) {
        if (lockedRef.current !== null) return lockedRef.current === lockKey(model)
        if (sameModel(model, target)) {
          lockedRef.current = lockKey(model)
          return true
        }
        const c = target.getCenter()
        const at = model.getCenter()
        if (
          !c ||
          !(withinRange(c, p, reachOf(model)) || (at && withinRange(c, at, reachOf(model))))
        )
          return false
        lockedRef.current = lockKey(model)
        return true
      },
      clamp(p, model) {
        // The snapped piece: its base keeps touching the short end edge of the tool at the snapped end,
        // and may overlap the tool there, as with Place (endEdgeClamp).
        // The tool stays where it is.
        if (sameModel(model, target)) {
          if (!rigidRef.current) return
          const shape = toolShape(toolPose(rigidRef.current), turn)
          const spot = endEdgeClamp(shape, snap.side, tip, halfWidth, p, model.radius)
          p.x = spot.x
          p.z = spot.z
          return
        }
        const c = target.getCenter()
        if (!c) return
        now.current.follow?.(model, p)
        const spot = clampRange(c, p, reachOf(model))
        p.x = spot.x
        p.z = spot.z
      },
    })
    return () => onPlaceLimit?.(null)
  }, [lockOne, snap, turn, tip, halfWidth, now])

  // The clamp reads the tool pose at each call, so the tool can move while Throw is on
  useEffect(() => {
    if (!throwing) return undefined
    const { models, onPlaceLimit, rigidRef, world, rapier } = now.current
    const { side, target } = throwLock
    onPlaceLimit?.({
      owns: (model) => sameModel(model, target),
      clamp(p) {
        if (!rigidRef.current) return
        const { start, dir, moved } = throwStop(
          { world, rapier, models },
          toolShape(toolPose(rigidRef.current), turn),
          side,
          tip,
          target,
        )
        const spot = lineClamp(start, dir, moved, p)
        p.x = spot.x
        p.z = spot.z
      },
    })
    return () => onPlaceLimit?.(null)
  }, [throwing, throwLock, turn, tip, now])

  // One Place or Throw at a time across the own tools: this tool takes the drag limit, and turns its own
  // off when the other tool takes it. Each tool clears only its own slot (onPlaceLimit in Scene.jsx).
  const limiting = placing || throwing || lockOne
  useEffect(() => {
    if (limiting) now.current.onLimitOn?.()
  }, [limiting, now])
  // Both are state that follows a prop, so they are set during the render, not in an effect
  const [wasTaken, setWasTaken] = useState(limitTaken)
  if (limitTaken !== wasTaken) {
    setWasTaken(limitTaken)
    if (limitTaken) {
      setPlaceSide(null)
      setThrowLock(null)
      setPlaceOne(false)
    }
  }
  // A free tool has no snapped piece to lock to
  if (!snap && placeOne) setPlaceOne(false)

  // Place (docs/features/range-movement-tools.md, "Place") turns on and off. It moves nothing: the first
  // character that touches the outline during a drag is locked to it.
  function togglePlace(e) {
    e.stopPropagation()
    if (placeSide) {
      setPlaceSide(null)
      return
    }
    if (!snap || throwLock) return
    setPlaceOne(false)
    setPlaceSide(OTHER[snap.side])
  }

  // Range 1 tool, snapped: Place 1 turns on and off. It moves nothing: the first character that a drag
  // brings within range 1 of the snapped piece is locked there. A drag of the snapped piece locks it, if
  // nothing is locked yet. It turns Place 2 off.
  function handlePlaceOne(e) {
    e.stopPropagation()
    if (placeOne) {
      setPlaceOne(false)
      return
    }
    if (!snap) return
    setPlaceSide(null)
    setPlaceOne(true)
  }

  // Throw / Push (docs/features/range-movement-tools.md, "Throw / Push") turns on and off. It moves
  // nothing: it locks the snapped character, so its drag stays on the middle line of the tool, from the
  // snapped end toward the far end. The line stops at the first character base, terrain piece or mat
  // edge (see throwPath.js). A lifted character does not stop it, so the player lifts a character that
  // the move should pass. The rules use a straight tool, so a bent tool is straightened first: the far
  // half lines up with the snapped half, and the snapped end stays on the base.
  function handleThrow(e) {
    e.stopPropagation()
    if (throwLock) {
      setThrowLock(null)
      return
    }
    const model = snap?.target
    const rb = liveRb()
    if (!model?.getBody?.() || !rb || placeSide) return
    // The other player moves this model: no Throw
    if (model.claim && !model.claim()) return
    const far = OTHER[snap.side]
    const straight = { [snap.side]: turn[snap.side], [far]: turn[snap.side] }
    setTurn(straight)
    setThrowLock({ side: snap.side, target: model })
  }

  // Unsnap turns Place, Place 1 and Throw off
  function clearLimits() {
    setPlaceSide(null)
    setPlaceOne(false)
    setThrowLock(null)
  }

  // Advance (docs/features/range-movement-tools.md, "Advance"): a right click on the far half moves the
  // snapped character to the far end, by a slide. Throw off: along the tool, bent as it is, no collision.
  // Throw on: along the Throw line, up to the stop point. No Advance for a token, a lifted character,
  // an angle tool or a character that the other player moves. A slide that would be refused (a drag or
  // the remote mode holds the body) is checked before the claim, so it claims nothing and counts no move.
  function handleAdvance() {
    const target = throwLock ? throwLock.target : snap?.target
    const rb = liveRb()
    if (!target?.getBody?.() || !rb || target.isLifted() || angle) return
    if (!target.canSlide()) return
    if (target.claim && !target.claim()) return
    const shape = toolShape(toolPose(rb), turn)
    let points
    if (throwLock) {
      const { start, dir, moved } = throwStop(
        { world, rapier, models },
        shape,
        throwLock.side,
        tip,
        target,
      )
      // From where the character is now, kept on the line
      const from = lineClamp(start, dir, moved, target.getCenter())
      points = [from, { x: start.x + dir.x * moved, z: start.z + dir.z * moved }]
    } else {
      points = advancePath(shape, snap.side, tip, target.radius, target.getCenter())
    }
    target.moved?.()
    const { path, duration } = slidePath(groundedPath(world, rapier, points, target.radius))
    target.slide(path, duration)
  }

  return {
    placeSide,
    placeOne,
    throwLock,
    placing,
    lockOne,
    throwing,
    placeButtonSide,
    lockMode,
    limiting,
    togglePlace,
    handlePlaceOne,
    handleThrow,
    handleAdvance,
    clearLimits,
  }
}

// The Throw line of target from half `side` and where it stops (throwMove): { start, dir, distance, moved }.
// Found again at each call, from the live tool shape and the other characters.
function throwStop({ world, rapier, models }, shape, side, tip, target) {
  const line = throwLine(shape, side, tip, target.radius)
  const { moved } = throwMove(world, rapier, {
    ...line,
    radius: target.radius,
    others: throwOthers(models, target),
  })
  return { ...line, moved }
}

// The bases that stop a Throw of target: the other characters on the table, not lifted
function throwOthers(models, target) {
  return models
    .filter(
      (other) =>
        other.kind === 'character' &&
        !sameModel(other, target) &&
        other.getBody() &&
        !other.isLifted(),
    )
    .map((other) => ({ center: other.getCenter(), radius: other.radius }))
}
