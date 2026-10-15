import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { BODY_DYNAMIC, BODY_KINEMATIC_POSITION, liveBody } from '../physics.js'
import { HOVER_RATE } from '../pieces/heights.js'
import { ndcFromClient } from '../drag/screenRay.js'
import { startPointerDrag } from '../drag/pointerDrag.js'
import { wrapAngle, toolPose, yawQuat, yawTo } from '../components/toolGeometry.js'

// Height of a FlatHtml above the body center
export const FLAT_HTML_Y = 0.25

// Whole-body drag: a click toggles the selection, a drag moves the tool at once and selects it.
// onPointerDown(e, onSelect, onDragSelect, plan): e is an R3F event of the tool mesh, or a DOM pointerdown of a
// button on the tool (the grab point is then the pointer ray on the plane of the button). onSelect is the click
// handler: the selection for the mesh, the button action for a button. plan() is called once when a drag starts (not on a
// plain click). It returns null for a move, or { pivot, onTurn, onPointer } for a turn:
// - Move: the tool follows the pointer. onDragMove(raycaster) is called on each pointer move, with a
//   raycaster set to the pointer ray. When it returns true, the drag ends there and the rest of that
//   press does nothing.
// - Turn: the pointer turns around pivot (table XZ), and onTurn(d, startPose) returns the tool pose
//   for a turn of d (yaw) since the drag started. refresh (optional): onTurn is also called on every frame, with the last d.
//   onPointer(raycaster) is called on each pointer
//   move with a raycaster set to the pointer ray, and with null when the drag ends.
// In both, the tool stays hoverHeight above the table or terrain under its footprint (from groundY),
// as a dragged model does. onDragStart(kind): called once when a drag starts, with 'move', 'turn' or the
// plan's own kind (RulerTool: 'bend').
// The returned onPointerDown has stepTurn(angle): during a turn drag it adds angle to the turn (extra), so
// onTurn gets d + extra and the next pointer move goes on from there. It returns false when no turn drag is on.
// onDragEnd: called once when a drag ends, also when onDragMove ends it.
export function useDragTool(rigidRef, groundY, hoverHeight, onDragStart, onDragMove, onDragEnd) {
  const { camera, gl, controls } = useThree()
  const { world } = useRapier()
  // The running pointer drag, so an unmount can cancel it
  const dragHandle = useRef(null)
  useEffect(
    () => () => {
      dragHandle.current?.cancel('unmount')
      dragHandle.current = null
    },
    [],
  )
  const isDragging = useRef(false)
  const mouseNDC = useRef({ x: 0, y: 0 })
  const restType = useRef(BODY_DYNAMIC)
  const raycaster = useRef(new THREE.Raycaster())
  // Horizontal plane through the grabbed point, so the pointer stays on the same spot of the tool
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  // Grabbed point minus body center (XZ), so the tool does not jump to center on the pointer
  const grabOffset = useRef({ x: 0, z: 0 })
  // Turn drag: the plan, with startPose, startAngle (yaw from the pivot to the grabbed point), extra (turn added
  // by stepTurn) and pose, the next kinematic pose { x, z, yaw }. Y follows the ground. null for a move drag.
  const turning = useRef(null)

  function turnOf(turn) {
    return wrapAngle((turn.d ?? 0) + turn.extra)
  }

  useFrame((_, dt) => {
    const rb = rigidRef.current
    if (!isDragging.current || !rb) return
    const t = rb.translation()
    // A plan with refresh gets its pose again on every frame, not only at a pointer move, so a change that is
    // not a pointer move (Q / E during a turn) shows at once
    const turn = turning.current
    if (turn?.refresh && turn.d !== undefined) turn.pose = turn.onTurn(turnOf(turn), turn.startPose)
    let pose = turning.current?.pose
    if (!pose) {
      // The plane stays at the grab height. If it followed the tool, raising the tool would move
      // the pointer hit off the terrain, the tool would drop, and it would shake between heights.
      raycaster.current.setFromCamera(mouseNDC.current, camera)
      const target = new THREE.Vector3()
      if (!raycaster.current.ray.intersectPlane(dragPlane.current, target)) return
      pose = {
        x: target.x - grabOffset.current.x,
        z: target.z - grabOffset.current.z,
        yaw: toolPose(rb).yaw,
      }
    }
    const { x, z, yaw } = pose
    // Off the table there is no ground, so keep the current height
    const ground = groundY(x, z, yaw)
    const y =
      ground === null ? t.y : t.y + (ground + hoverHeight - t.y) * Math.min(1, dt * HOVER_RATE)
    // A sleeping body keeps moving but its mesh is not synced, so keep it awake
    rb.wakeUp()
    rb.setNextKinematicTranslation({ x, y, z })
    if (turning.current) rb.setNextKinematicRotation(yawQuat(yaw))
  })

  function stepTurn(angle) {
    const turn = turning.current
    if (!turn) return false
    turn.extra += angle
    turn.pose = turn.onTurn(turnOf(turn), turn.startPose)
    return true
  }

  function onPointerDown(e, onSelect, onDragSelect, plan) {
    let point = e.point
    if (!point) {
      // A DOM event (a button): the pointer ray, on the horizontal plane of the button
      const ndc = ndcFromClient(gl.domElement, e.clientX, e.clientY)
      raycaster.current.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera)
      const y = (rigidRef.current?.translation().y ?? 0) + FLAT_HTML_Y
      point = new THREE.Vector3()
      if (
        !raycaster.current.ray.intersectPlane(
          new THREE.Plane(new THREE.Vector3(0, 1, 0), -y),
          point,
        )
      )
        return
    }
    const grab = { x: point.x, z: point.z }
    function endDrag() {
      isDragging.current = false
      turning.current?.onPointer?.(null)
      turning.current = null
      if (liveBody(world, rigidRef.current)) rigidRef.current.setBodyType(restType.current, true)
      onDragEnd?.()
    }

    const pressed = startPointerDrag(e, {
      controls,
      canvas: gl.domElement,
      canStart: () => liveBody(world, rigidRef.current),
      onStart: () => {
        onDragSelect?.()
        const rb = rigidRef.current
        restType.current = rb.bodyType()
        rb.setBodyType(BODY_KINEMATIC_POSITION, true)
        isDragging.current = true
        const turn = plan?.() ?? null
        if (turn) {
          const startPose = toolPose(rb)
          turning.current = {
            ...turn,
            startPose,
            startAngle: yawTo(turn.pivot, grab),
            extra: 0,
            pose: startPose,
          }
        }
        onDragStart?.(turn ? (turn.kind ?? 'turn') : 'move')
      },
      // true: onDragMove ended the drag, and the rest of that press does nothing
      onMove: (ev) => {
        mouseNDC.current = ndcFromClient(gl.domElement, ev.clientX, ev.clientY)
        raycaster.current.setFromCamera(mouseNDC.current, camera)
        const turn = turning.current
        if (turn) {
          turn.onPointer?.(raycaster.current)
          const hit = raycaster.current.ray.intersectPlane(dragPlane.current, new THREE.Vector3())
          if (!hit || Math.hypot(hit.x - turn.pivot.x, hit.z - turn.pivot.z) < 0.01) return false
          turn.d = wrapAngle(yawTo(turn.pivot, hit) - turn.startAngle)
          turn.pose = turn.onTurn(turnOf(turn), turn.startPose)
          return false
        }
        return Boolean(onDragMove?.(raycaster.current))
      },
      onEnd: endDrag,
      // Esc: the tool stays where it is. A press that did not start has nothing to end.
      onCancel: () => {
        if (isDragging.current) endDrag()
      },
      onClick: () => onSelect?.(),
      // A DOM press: no default, so the browser does not select text or focus
      preventDefault: true,
    })
    dragHandle.current = pressed || null
    if (pressed && rigidRef.current) {
      const t = rigidRef.current.translation()
      dragPlane.current.constant = -point.y
      grabOffset.current = { x: point.x - t.x, z: point.z - t.z }
    }
  }
  onPointerDown.stepTurn = stepTurn
  return onPointerDown
}
