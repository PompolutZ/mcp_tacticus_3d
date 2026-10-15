import { RigidBody, ConvexHullCollider, useRapier } from '@react-three/rapier'
import { useMemo, useRef, useState, useEffect } from 'react'
import { useOnMount } from './useLatest.js'
import * as THREE from 'three'
import { useBodyRef } from '../useBodyRef.js'
import { nearestHit } from '../drag/screenRay.js'
import { outlineMode, useOutline } from './SelectionOutlines.jsx'
import { useHoverCursor, useHoverReport, useDragEndOnUnmount } from './useHoverCursor.js'
import { freeSpawnYaw } from './storedTool.js'
import { MOVE_TIP, RANGE_TIP } from '../tabletools/toolTips.js'
import { onRack } from '../tabletools/layout.js'
import { useDragTool } from '../tabletools/useDragTool.js'
import { useToolLimits } from '../tabletools/useToolLimits.js'
import { useToolStore } from '../tabletools/useToolStore.js'
import { useFootprintGround } from '../tabletools/useFootprintGround.js'
import { ToolFootprint, RangeMark } from './ToolFootprint.jsx'
import { aimTurn } from './aimTurn.js'
import { toolAction } from './toolInput.js'
import { useRangeParts, useMovementParts, hullPoints } from './ToolParts.jsx'
import { FlatHtml, ToolButton, BendButton } from './ToolButtons.jsx'
import {
  SIDES,
  OTHER,
  STRAIGHT,
  ANGLE_TURN,
  RANGE_HALF_WIDTH,
  MOVE_HALF_WIDTH,
  yawQuat,
  wrapAngle,
  toolPose,
  toolShape,
  turnAround,
  anglePose,
  aimPose,
  limitTurn,
  sameModel,
  spawnPose,
  snapPlacement,
} from './toolGeometry.js'

// A movement tool bends at its hinge, but never past a right angle, the same as the plastic one
const MAX_BEND = Math.PI / 2
// Place sits this far in from the tip, and so does Throw at the other end. On a movement tool, these
// buttons are turned across the tool, so along the tool they take only their height, about 0.27" for
// Place and 0.4" for Throw.
const PLACE_INSET = 0.75

// target: the piece selected last, a model or a token, as { id, kind, getObject, getCenter, radius,
// getBody? }, or null. The tool measures against it. By default it also snaps to it when it spawns
// (spawnTarget in Tool). getBody is only there for a model (a character), with claim(): false when the other
// player moves the model, so Throw does nothing to it. models: every character and token, in the same form,
// for the pointer raycast and the snap. onSnap(model): the tool snapped to that model during a drag.
// onPlaceLimit(limit): called with { owns(model, p), clamp(p, model) } (model in the models form above) while Place, Place 1 or Throw is on,
// and with null after. owns says if this tool limits the drag of that model to point p (table XZ). Place and
// Place 1 lock the first model that touches the outline or comes within range 1, see docs/features/range-movement-tools.md.
// clamp moves p, so the base keeps touching the footprint (Place, Place 2) or stays within range 1
// of the snapped piece (Place 1, see rangeOne.js).
// limitTaken: the other own tool has Place or Throw on, so this tool turns its Place and Throw off. onLimitOn():
// called when this tool's Place or Throw turns on (the drag limit). Only one own tool has it at a time.
// onSpawn: called once, when the tool is created
// team: 'blue' or 'red', the player tint of the tool
// hoverHeight: how far above the table or terrain the tool hangs while dragged
// number 1: range 1 has no tool of its own. As with "Snap 1" in the TTS mod, the Range 2 tool lies
// across the line from the base, and its 1" width measures range 1. See docs/features/range-movement-tools.md, "Tools".
export function RangeRuler({ number = 2, team, ...props }) {
  const rangeOne = number === 1
  const mesh = rangeOne ? 2 : number
  const parts = useRangeParts(mesh, team)
  return (
    <Tool
      parts={parts}
      tip={RANGE_TIP[mesh] ?? 1.501}
      halfWidth={RANGE_HALF_WIDTH}
      rangeOne={rangeOne}
      {...props}
    />
  )
}

// Movement tool: mesh-a is the right half with the round hinge, mesh-b is the left half
export function MovementRuler({ type = 'short', team, ...props }) {
  const parts = useMovementParts(type, team)
  return (
    <Tool
      parts={parts}
      tip={MOVE_TIP[type] ?? 1.574}
      halfWidth={MOVE_HALF_WIDTH}
      bendable
      {...props}
    />
  )
}

// Angle tool, for Toward / Away: a copy of the long movement tool, always bent to a right angle.
// See docs/features/range-movement-tools.md, "Toward / Away".
export function AngleRuler({ team, ...props }) {
  const parts = useMovementParts('long', team)
  return <Tool parts={parts} tip={MOVE_TIP.long} halfWidth={MOVE_HALF_WIDTH} angle {...props} />
}

// Tool that measures with its footprint. See docs/features/range-movement-tools.md, "Tools".
// parts: [{ obj, side }], the meshes of the tool. A part with a side turns with that half.
// tip: X of each end (length of each half of the footprint).
// bendable: a movement tool. Its halves turn around the hinge at the center.
// rangeOne: the range 1 tool. It snaps with a corner, not an end. See docs/features/range-movement-tools.md, "Range 1".
// onRangeMark(mark): the piece that a turn of the snapped tool measures against, see RangeMark. Only
// the range tools pass it. Without it, the tool marks no pieces.
// onHover(over): the pointer moved onto (true) or off (false) the tool. onDrag(on): a drag of the
// tool started (true) or ended (false). Both are also called with false on unmount.
// turnRef(turn): gets stepTool, for Q / E (see turnPiece in usePieceTurns.js), and null on unmount.
// liveRef(get): gets a function that returns the live pose { x, y, z, yaw, right, left } of the tool (LiveSync.jsx
// sends it to the other player), and null on unmount.
// spawnTarget: the piece the tool snaps to when it spawns, target by default. Without one it spawns
// at the origin.
// entry: the stored tool entry of the own side (storedTool.js), read only when the tool mounts:
// - with a pose, the tool starts there, with the stored turn, snap and mode. A snap whose piece is gone
//   gives a free tool.
// - without a pose, it is a new spawn. With `at`, the tool spawns free there (no snap), hoverHeight
//   above the ground under its footprint, with the yaw of freeSpawnYaw(side). Without `at`, the rules
//   above.
// Later changes of the entry (the tool's own writes) do not move the tool.
// side: 'host' or 'guest', the side of the owner. onStore(fields): called with { pose, turn, snap, mode }
// (rounded, storedTool.js) when none of them changed for REST_TIME and they differ from the entry.
// Not stored: Place, Throw, Bend and the selection.
// onReturn(): called when a move drag (not a turn drag) ends with the tool center on the own rack. The owner
// removes the tool then (docs/features/table-tools.md, "Tool rack"). Without it, the tool does not return.
// angle: the angle tool. It starts bent 90° and cannot bend, place or throw. It spawns aimed at aim
// (a model) or at the mat center.
// angleRef(get): gets a function that returns { target, openYaw } while the angle tool is snapped, else
// null, and null on unmount. angleLimit(model): on a movement tool, the openYaw of the angle tool
// snapped to that model, else null. The movement tool then keeps its move direction within
// ANGLE_LIMIT of it, while snapped to that model. Read at each use, because the angle tool can move.
function Tool({
  parts,
  tip,
  halfWidth,
  bendable = false,
  rangeOne = false,
  angle = false,
  aim = null,
  angleLimit,
  angleRef,
  entry,
  side: ownSide,
  onStore,
  onReturn,
  hoverHeight = 1,
  selected = false,
  onSelect,
  onDragSelect,
  target,
  spawnTarget = target,
  models = [],
  onSnap,
  onPlaceLimit,
  limitTaken = false,
  onLimitOn,
  onSpawn,
  onRangeMark,
  onHover,
  onDrag,
  turnRef,
  liveRef,
}) {
  const [hovered, setHovered] = useState(false)
  // The entry at mount (see above)
  const [start] = useState(entry)
  const restored = Boolean(start.pose)
  const spawnAt = restored ? null : (start.at ?? null)
  const spawnYaw = freeSpawnYaw(ownSide)
  const { rigidRef, liveRb, world } = useBodyRef()
  // The tool meshes, for the outline
  const partsRef = useRef()
  // Stays STRAIGHT on a tool that is not bendable, and ANGLE_TURN on the angle tool
  const [turn, setTurn] = useState((restored && start.turn) || (angle ? ANGLE_TURN : STRAIGHT))
  // Angle tool: where the hinge goes when the tool aims at a piece
  const [mode, setMode] = useState((restored && start.mode) || 'away')
  // While the bend button is on, a drag on a half turns that half instead of the whole tool
  const [bendOn, setBendOn] = useState(false)
  // Snapped: { target, side, across }, the model the tool is snapped to and the half whose end touches
  // its base. across (R1 tool only): the long side (±1: local ±Z) that the base touches.
  // Free: null. See docs/features/range-movement-tools.md, "Tools".
  const [snap, setSnap] = useState(() => {
    const stored = restored && start.snap
    const target = stored && models.find((model) => sameModel(model, stored))
    return target ? { target, side: stored.side, across: stored.across } : null
  })
  // Model under the pointer at the last move of a body drag, or null. undefined before the first move.
  // The tool snaps when the pointer moves onto a model, not when the drag starts on one.
  const overRef = useRef(undefined)
  // Model under the pointer while a drag turns the snapped tool around the base, else null. See RangeMark.
  const measuredRef = useRef(null)
  // The drag in progress: 'move', 'turn', 'bend' or null. See useDragTool.
  const dragKind = useRef(null)
  // The half grabbed by a bend drag, and the half under the pointer (null: none, or a range tool)
  const bendSide = useRef(null)
  const hoverSide = useRef(null)
  const groundY = useFootprintGround(tip, halfWidth, turn)
  const onPointerDown = useDragTool(
    rigidRef,
    groundY,
    hoverHeight,
    (kind) => {
      // Only a free tool moves (see dragPlan)
      if (kind === 'move') overRef.current = undefined
      // Runs after the render, so the later function is set
      // eslint-disable-next-line react-hooks/immutability
      dragChange(kind)
    },
    onDragMove,
    () => {
      const kind = dragKind.current
      // eslint-disable-next-line react-hooks/immutability
      dragChange(null)
      // Read on use: the closure is from the render of the press
      // eslint-disable-next-line react-hooks/immutability
      const giveBack = latest.current?.onReturn
      const rb = liveRb()
      if (kind !== 'move' || !giveBack || !rb) return
      const { x, z } = rb.translation()
      if (onRack(ownSide, { x, z })) giveBack()
    },
  )
  const { rapier } = useRapier()
  const hulls = useMemo(() => parts.map((part) => hullPoints(part.obj)), [parts])

  function partTurn(part) {
    return part.side ? turn[part.side] : 0
  }

  function dragChange(kind) {
    dragKind.current = kind
    onDrag?.(kind !== null)
  }

  // How a drag that starts on half side (undefined on a range tool) moves the tool. See useDragTool.
  // Bend on: the grabbed half turns around the hinge, and the other half does not move. On a snapped
  // tool only the far half bends, so the end on the base keeps touching it.
  // Else a snapped tool turns around the base center. The distance to the base does not change, so
  // the tool keeps touching the base. A free tool moves. Only a move snaps the tool (onDragMove), so
  // a drag that starts snapped never snaps to another piece, also when the pointer passes over one.
  function dragPlan(side) {
    const rb = liveRb()
    if (!rb) return null
    const action = toolAction(
      { snapped: !!snap, snappedSide: snap?.side, bendable, bendOn, side, drag: null },
      'drag',
    )
    if (action.kind === 'bend') {
      const { x, z } = toolPose(rb)
      const other = turn[OTHER[side]]
      bendSide.current = side
      return {
        kind: 'bend',
        pivot: { x, z },
        onTurn(d, pose) {
          setTurn({
            ...turn,
            [side]: THREE.MathUtils.clamp(turn[side] + d, other - MAX_BEND, other + MAX_BEND),
          })
          return pose
        },
      }
    }
    if (action.kind !== 'turnBase') return null
    // The piece under the pointer is the one the tool measures against. Not the snapped one.
    const { target: snapped, side: snappedSide } = snap
    const pivot = snapped.getCenter()
    const range = !angle && !bendable
    // Range tool: after aiming at a piece, the plain turn goes on from the aimed pose (d at that move)
    let rebase = null
    return {
      pivot,
      onTurn(d, pose) {
        // Angle tool over another piece: the line through its center, not a plain turn
        if (angle && measuredRef.current)
          return aimPose(pivot, snapped.radius, halfWidth, measuredRef.current.getCenter(), mode)
        if (range) {
          const base = rebase?.pose ?? pose
          const over = measuredRef.current
          if (over) {
            // The direction from the base into the tool: along the tool, or across it on R1
            const dir = rangeOne
              ? { x: 0, z: -(snap.across ?? 1) }
              : { x: snappedSide === 'left' ? 1 : -1, z: 0 }
            const aimed = turnAround(base, pivot, aimTurn(base.yaw, dir, pivot, over.getCenter()))
            rebase = { pose: aimed, d }
            return aimed
          }
          return rebase
            ? turnAround(base, pivot, wrapAngle(d - rebase.d))
            : turnAround(pose, pivot, d)
        }
        const open = angleLimit?.(snapped) ?? null
        if (open === null) return turnAround(pose, pivot, d)
        // A movement tool at an angle tool: the turn changes the move direction by d, so cut d
        return turnAround(
          pose,
          pivot,
          limitTurn(toolShape(pose, turn)[snappedSide] + Math.PI, open, d),
        )
      },
      onPointer(raycaster) {
        const model = raycaster && modelUnder(raycaster)
        measuredRef.current = model && !sameModel(model, snapped) ? model : null
      },
    }
  }

  // Q / E and the wheel: a step of angle (yaw), as toolAction says (docs/features/range-movement-tools.md,
  // "Input rules"). usePieceTurns.js (turnPiece) calls it on every frame of a smoothed turn.
  // - During a turn or bend drag the step goes to the drag (useDragTool), which sets the pose.
  // - Turn around the tool center (the hinge on a movement tool): the tool keeps its bend. Both ends move,
  //   so a snapped tool is free after it. A tool that is not dragged then hangs hoverHeight above the ground
  //   under its new outline (a move drag already does this on every frame).
  // - Turn around the base: the snap stays, and an angle tool limits it (limitTurn).
  // - Bend: the same clamp as a bend drag.
  function stepTool(angle) {
    const rb = liveRb()
    if (!rb) return
    const drag = dragKind.current
    const action = toolAction(
      {
        snapped: !!snap,
        snappedSide: snap?.side,
        bendable,
        bendOn,
        side: drag === 'bend' ? bendSide.current : hoverSide.current,
        drag,
      },
      'step',
    )
    if (action.kind === 'none') return
    if ((drag === 'turn' || drag === 'bend') && onPointerDown.stepTurn(angle)) return
    if (action.kind === 'bend') {
      const { side } = action
      setTurn((prev) => ({
        ...prev,
        [side]: THREE.MathUtils.clamp(
          prev[side] + angle,
          prev[OTHER[side]] - MAX_BEND,
          prev[OTHER[side]] + MAX_BEND,
        ),
      }))
      return
    }
    const pose = toolPose(rb)
    if (action.kind === 'turnBase' && snap) {
      const pivot = snap.target.getCenter()
      const open = angleLimit?.(snap.target) ?? null
      const d =
        open === null ? angle : limitTurn(toolShape(pose, turn)[snap.side] + Math.PI, open, angle)
      const placed = turnAround(pose, pivot, d)
      const ground = groundY(placed.x, placed.z, placed.yaw)
      rb.setTranslation(
        {
          x: placed.x,
          y: ground === null ? rb.translation().y : ground + hoverHeight,
          z: placed.z,
        },
        true,
      )
      rb.setRotation(yawQuat(placed.yaw), true)
      return
    }
    if (action.kind !== 'turnCenter') return
    if (!drag) {
      const ground = groundY(pose.x, pose.z, pose.yaw + angle)
      if (ground !== null)
        rb.setTranslation({ x: pose.x, y: ground + hoverHeight, z: pose.z }, true)
    }
    rb.setRotation(yawQuat(pose.yaw + angle), true)
    setSnap(null)
  }

  // Registered on every render, so the turn reads the current state
  useEffect(() => {
    turnRef?.(stepTool)
    return () => turnRef?.(null)
  })

  useEffect(() => {
    if (!angle) return undefined
    angleRef?.(() => {
      const rb = liveRb()
      return snap && rb ? { target: snap.target, openYaw: toolPose(rb).yaw + Math.PI / 2 } : null
    })
    return () => angleRef?.(null)
  })

  // The cleanups also run on unmount, so a removed tool does not stay hovered or dragged. Escape
  // removes the selected tool, also during its drag.
  useHoverReport(hovered, onHover)
  useDragEndOnUnmount(onDrag)
  // A click toggles the selection. A drag moves the tool at once and selects it.
  useHoverCursor(hovered, 'grab')

  // Nearest of the models (default: all of them) under the pointer ray (figure or base), or null
  function modelUnder(raycaster, list = models) {
    return nearestHit(
      raycaster,
      list.map((m) => [m, m.getObject()]),
    )
  }

  // Body drag: when the pointer moves onto a model, snap to it and end the drag
  function onDragMove(raycaster) {
    const model = modelUnder(raycaster)
    const entered = model && overRef.current !== undefined && model !== overRef.current
    overRef.current = model
    if (!entered || !snapTo(model)) return false
    onSnap?.(model)
    return true
  }

  // Move the tool without turning it, so that the end nearer to the model's base touches the base edge.
  // Range 1: the corner nearer to the base touches it instead.
  function snapTo(model) {
    const c = model.getCenter()
    const rb = liveRb()
    if (!c || !rb) return false
    const open = angle ? null : (angleLimit?.(model) ?? null)
    const placed = snapPlacement(toolPose(rb), turn, c, model.radius, {
      angle,
      rangeOne,
      bendable,
      tip,
      halfWidth,
      open,
    })
    if (placed.flipped) {
      rb.setRotation(yawQuat(placed.flipped.pose.yaw), true)
      setTurn(placed.flipped.turn)
    }
    const { x, z } = placed
    const ground = groundY(x, z, placed.yaw)
    rb.setTranslation(
      { x, y: ground === null ? rb.translation().y : ground + hoverHeight, z },
      true,
    )
    // The angle tool keeps its yaw
    if (!angle) rb.setRotation(yawQuat(placed.yaw), true)
    setSnap(
      angle
        ? { target: model, side: placed.side }
        : { target: model, side: placed.side, across: placed.across },
    )
    return true
  }

  // Mounted with a pose: the RigidBody starts there, nothing to do. Spawned with a spawnAt: start free at
  // that point. Spawned with a spawnTarget: start snapped to it.
  useOnMount(() => {
    if (restored) return
    onSpawn?.()
    const rb = liveRb()
    if (spawnAt) {
      // Free: no snap
      if (rb) {
        const ground = groundY(spawnAt.x, spawnAt.z, spawnYaw) ?? 0
        rb.setTranslation({ x: spawnAt.x, y: ground + hoverHeight, z: spawnAt.z }, true)
        rb.setRotation(yawQuat(spawnYaw), true)
      }
      return
    }
    const center = spawnTarget?.getCenter()
    if (!center || !rb) return
    // snapPoseOne puts the base on the +Z long side. A movement tool snaps with its right (indented) end.
    const spawnSide = bendable ? 'right' : 'left'
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSnap({ target: spawnTarget, side: spawnSide, across: 1 })
    // The angle tool aims at the aim piece, or at the mat center. A movement tool at an angle tool points along it.
    const pose = spawnPose({
      center,
      radius: spawnTarget.radius,
      angle,
      rangeOne,
      bendable,
      aimPoint: angle ? aim?.getCenter() : undefined,
      tip,
      halfWidth,
      open: angle || rangeOne ? undefined : angleLimit?.(spawnTarget),
    })
    const ground = groundY(pose.x, pose.z, pose.yaw) ?? 0
    rb.setTranslation({ x: pose.x, y: ground + hoverHeight, z: pose.z }, true)
    rb.setRotation(yawQuat(pose.yaw), true)
    // Only at spawn. Selecting another character later must not move the tool.
  })

  const latest = useToolStore({ liveRb, liveRef, turn, snap, mode, entry, onStore, onReturn })

  // The snapped piece left the table (a removed character, a token that a character took), so the
  // tool is free. Else a drag would turn the tool around a point where the piece is no longer.
  useEffect(() => {
    if (snap && !models.some((model) => sameModel(model, snap.target)))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSnap(null)
  }, [snap, models])

  useOutline(partsRef, outlineMode(selected, hovered))

  const {
    placeSide,
    throwLock,
    lockOne,
    placeButtonSide,
    togglePlace,
    handlePlaceOne,
    handleThrow,
  } = useToolLimits({
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
    limitTaken,
    onLimitOn,
  })

  // Angle tool, snapped: move the tool to the other side of the base, the same angle turned half
  // around. Toward becomes Away and Away becomes Toward.
  function handleMirror(e) {
    e.stopPropagation()
    const rb = liveRb()
    if (!snap || !rb) return
    const c = snap.target.getCenter()
    const pose = anglePose(
      c,
      snap.target.radius,
      halfWidth,
      toolPose(rb).yaw + Math.PI / 2 + Math.PI,
    )
    const ground = groundY(pose.x, pose.z, pose.yaw)
    rb.setTranslation(
      { x: pose.x, y: ground === null ? rb.translation().y : ground + hoverHeight, z: pose.z },
      true,
    )
    rb.setRotation(yawQuat(pose.yaw), true)
    setMode((m) => (m === 'away' ? 'toward' : 'away'))
  }

  function toggleBend(e) {
    e.stopPropagation()
    setBendOn((on) => !on)
  }

  // onPointerDown of a button: a drag from it moves the tool like a drag of the half on side (none: the middle),
  // a click runs action.
  function grab(action, side) {
    return (e) =>
      onPointerDown(
        e,
        () => action(e),
        onDragSelect,
        () => dragPlan(side),
      )
  }

  return (
    <>
      {/* Held in the air like a real tool over terrain: kinematic, so it does not fall,
          and a sensor, so models pass under it. The footprint below is what measures. */}
      <RigidBody
        ref={rigidRef}
        type="kinematicPosition"
        position={
          restored
            ? [start.pose.x, start.pose.y, start.pose.z]
            : spawnAt
              ? [spawnAt.x, hoverHeight, spawnAt.z]
              : [0, 0, 0]
        }
        rotation={[0, restored ? start.pose.yaw : spawnAt ? spawnYaw : 0, 0]}
        colliders={false}
        sensor
      >
        <group ref={partsRef}>
          {parts.map((part) => (
            <group key={part.obj.uuid} rotation-y={partTurn(part)}>
              <primitive
                object={part.obj}
                onPointerOver={(e) => {
                  e.stopPropagation()
                  hoverSide.current = part.side ?? null
                  setHovered(true)
                }}
                onPointerOut={() => {
                  // The over of the next half may come first
                  if (hoverSide.current === (part.side ?? null)) hoverSide.current = null
                  setHovered(false)
                }}
                onPointerDown={(e) =>
                  onPointerDown(e, onSelect, onDragSelect, () => dragPlan(part.side))
                }
              />
            </group>
          ))}
        </group>
        {/* Not automatic colliders: those are made once from the meshes, so they would not turn with a half */}
        {parts.map((part, i) => (
          <ConvexHullCollider
            key={part.obj.uuid}
            args={[hulls[i]]}
            rotation={[0, partTurn(part), 0]}
          />
        ))}
        {SIDES.map((side) => (
          <group key={side} rotation-y={turn[side]}>
            {/* Place toggle, Place 2 on the R1 tool. It locks a character or a token to the tool. */}
            {selected && !angle && side === placeButtonSide && !throwLock && (
              <FlatHtml x={side === 'right' ? tip - PLACE_INSET : PLACE_INSET - tip}>
                <ToolButton
                  label={rangeOne ? 'Place 2' : 'Place'}
                  toolWidth={halfWidth * 2}
                  along={rangeOne}
                  on={placeSide !== null}
                  title={
                    placeSide !== null
                      ? 'Place on: the first character that touches the tool stays touching it'
                      : 'Lock the first character that touches the tool to it'
                  }
                  onClick={togglePlace}
                  onPointerDown={grab(togglePlace, side)}
                />
              </FlatHtml>
            )}
            {/* Throw / Push toggle of a movement tool: at the snapped end, and while it is on, at the end
                the Throw started from. Not while Place is on: Place can put the snapped model at this
                end, and then its button is here. Disabled for a token: it has no body, so there is
                nothing to move. */}
            {selected &&
              bendable &&
              (throwLock
                ? side === throwLock.side
                : snap && placeSide === null && side === snap.side) && (
                <FlatHtml x={side === 'right' ? tip - PLACE_INSET : PLACE_INSET - tip}>
                  <ToolButton
                    label={
                      <>
                        Throw
                        <br />
                        Push
                      </>
                    }
                    toolWidth={halfWidth * 2}
                    on={throwLock !== null}
                    disabled={!throwLock && !snap.target.getBody}
                    disabledTitle="Snap the tool to a character"
                    title={
                      throwLock
                        ? 'Throw on: the thrown character stays on the middle line of the tool'
                        : 'Throw or push the snapped character along the middle of the tool. It stops at the first character or terrain on the way.'
                    }
                    onClick={handleThrow}
                    onPointerDown={grab(handleThrow, side)}
                  />
                </FlatHtml>
              )}
          </group>
        ))}
        {selected && angle && snap && (
          // The label reads toward screen right when the tool is on the player's half and aims up the
          // screen. Mirroring turns the tool half around, so the label turns with it.
          <FlatHtml>
            <ToolButton
              label={
                <>
                  Toward
                  <br />
                  Away
                </>
              }
              toolWidth={halfWidth * 2}
              rotation={mode === 'away' ? 0 : 180}
              title="Move the tool to the other side of the base, to switch between Toward and Away"
              onClick={handleMirror}
              onPointerDown={grab(handleMirror)}
            />
          </FlatHtml>
        )}
        {selected && bendable && (
          <FlatHtml>
            <BendButton on={bendOn} onClick={toggleBend} onPointerDown={grab(toggleBend)} />
          </FlatHtml>
        )}
        {/* R1 tool: Place 1 is at the snapped end, on the half of the long side where it moves the
            character. Only while snapped, as in the TTS mod: without a snapped model, there is no
            corner to measure from. Disabled for a token: it has no body, so there is nothing to move. */}
        {selected && rangeOne && snap && (
          <FlatHtml
            x={snap.side === 'right' ? tip - PLACE_INSET : PLACE_INSET - tip}
            z={(-snap.across * halfWidth) / 2}
          >
            <ToolButton
              label="Place 1"
              toolWidth={halfWidth * 2}
              along
              on={lockOne}
              title={
                lockOne
                  ? 'Place 1 on: the first character within range 1 of the snapped model stays within range 1'
                  : 'Lock the first character that comes within range 1 of the snapped model'
              }
              onClick={handlePlaceOne}
              onPointerDown={grab(handlePlaceOne, snap.side)}
            />
          </FlatHtml>
        )}
      </RigidBody>
      <ToolFootprint
        rigidRef={rigidRef}
        turn={turn}
        halfLength={tip}
        halfWidth={halfWidth}
        selected={selected}
        target={target}
        rangeFrom={rangeOne ? (snap?.target ?? null) : null}
      />
      {onRangeMark && (
        <RangeMark
          rigidRef={rigidRef}
          turn={turn}
          halfLength={tip}
          halfWidth={halfWidth}
          rangeOne={rangeOne}
          snap={snap}
          measuredRef={measuredRef}
          onChange={onRangeMark}
        />
      )}
    </>
  )
}
