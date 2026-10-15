import { useRef, useState, useEffect } from 'react'
import { throwMove } from '../components/throwPath.js'
import { lineClamp, placeClamp, touches } from '../components/placeLock.js'
import { clampRange, rangeReach, withinRange } from '../components/rangeOne.js'
import {
  OTHER,
  toolPose,
  toolShape,
  throwLine,
  sameModel,
  lockKey,
} from '../components/toolGeometry.js'

// Place, Place 1 and Throw of a tool: what they limit during a drag of a model (onPlaceLimit), and their
// buttons' handlers (docs/features/range-movement-tools.md). Takes the state of the tool and gives the state
// of the three modes: { placeSide, placeOne, throwLock, placing, lockOne, throwing, placeButtonSide,
// lockMode, limiting, togglePlace, handlePlaceOne, handleThrow }. Call it after the effects it must follow
// (see Tool), the order of its effects is part of the behavior.
export function useToolLimits({
  selected,
  snap,
  turn,
  setTurn,
  tip,
  halfWidth,
  rigidRef,
  liveRb,
  world,
  rapier,
  models,
  onPlaceLimit,
  limitTaken = false,
  onLimitOn,
}) {
  // While Place is on: the far end at the time Place turned on. The Place button stays there.
  // Off: null. While Place is on, the locked character keeps its base touching the footprint.
  const [placeSide, setPlaceSide] = useState(null)
  const placing = selected && placeSide !== null
  // R1 tool: Place 1 is on. The first character that a drag brings within range 1 of the snapped piece is
  // locked there, until Place 1 turns off. The snapped piece itself is not locked.
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
  const modelsRef = useRef(models)
  modelsRef.current = models

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
        const spot = placeClamp(shape(), tip, halfWidth, p, model.radius)
        p.x = spot.x
        p.z = spot.z
      },
    })
    return () => onPlaceLimit?.(null)
  }, [placing, turn, tip, halfWidth])

  // Place 1 (rangeOne.js): the base edge stays within range 1 of the snapped piece edge, seen from above
  useEffect(() => {
    if (!lockOne) return undefined
    const { target } = snap
    const reachOf = (model) => rangeReach(target.radius, halfWidth * 2, model.radius)
    onPlaceLimit?.({
      owns(model, p) {
        if (sameModel(model, target)) return false
        if (lockedRef.current !== null) return lockedRef.current === lockKey(model)
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
        const c = target.getCenter()
        if (!c) return
        const spot = clampRange(c, p, reachOf(model))
        p.x = spot.x
        p.z = spot.z
      },
    })
    return () => onPlaceLimit?.(null)
  }, [lockOne, snap, halfWidth])

  // The clamp reads the tool pose at each call, so the tool can move while Throw is on
  useEffect(() => {
    if (!throwing) return undefined
    const { side, target } = throwLock
    onPlaceLimit?.({
      owns: (model) => sameModel(model, target),
      clamp(p) {
        if (!rigidRef.current) return
        const { start, dir, distance } = throwLine(
          toolShape(toolPose(rigidRef.current), turn),
          side,
          tip,
          target.radius,
        )
        // The stop point follows the live line: found again at each call (two casts and a few
        // circle tests), so a moved or turned tool, or a moved other character, counts
        const { moved } = throwMove(world, rapier, {
          start,
          dir,
          distance,
          radius: target.radius,
          others: throwOthers(target),
        })
        const spot = lineClamp(start, dir, moved, p)
        p.x = spot.x
        p.z = spot.z
      },
    })
    return () => onPlaceLimit?.(null)
  }, [throwing, throwLock, turn, tip])

  // One Place or Throw at a time across the own tools: this tool takes the drag limit, and turns its own
  // off when the other tool takes it. Each tool clears only its own slot (onPlaceLimit in Scene.jsx).
  const limiting = placing || throwing || lockOne
  useEffect(() => {
    if (limiting) onLimitOn?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limiting])
  useEffect(() => {
    if (!limitTaken) return
    setPlaceSide(null)
    setThrowLock(null)
    setPlaceOne(false)
  }, [limitTaken])
  // A free tool has no snapped piece to lock to
  useEffect(() => {
    if (!snap) setPlaceOne(false)
  }, [snap])

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
  // brings within range 1 of the snapped piece is locked there. It turns Place 2 off.
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

  // The bases that stop a Throw of target: the other characters on the table, not lifted
  function throwOthers(target) {
    return modelsRef.current
      .filter(
        (other) =>
          other.kind === 'character' &&
          !sameModel(other, target) &&
          other.getBody() &&
          !other.isLifted(),
      )
      .map((other) => ({ center: other.getCenter(), radius: other.radius }))
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
  }
}
