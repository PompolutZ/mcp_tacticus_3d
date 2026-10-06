import { useLoader, useFrame, useThree } from '@react-three/fiber'
import { useTexture, Html } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { RigidBody, ConvexHullCollider, useRapier } from '@react-three/rapier'
import { useMemo, useRef, useState, useEffect } from 'react'
import * as THREE from 'three'
import { baseGroundY, upright } from './CharacterModel.jsx'
import { acquireFootprint } from './footprintProjection.js'
import { castDown } from '../physics.js'
import { throwMove, throwSlide } from './throwPath.js'
import { assetUrl } from '../assets/index.js'
import { outlineMode, useOutline } from './SelectionOutlines.jsx'
import { useHoverCursor } from './useHoverCursor.js'

const TEXTURE = assetUrl('tools/toolbox-02.png')
const DRAG_THRESHOLD = 4
// How fast the dragged tool moves to the new hover height, per second (same as models)
const HOVER_RATE = 25
// Half height of the flat box cast down to find the ground under a footprint
const FOOTPRINT_CAST_HALF_H = 0.01
// Extra distance around the footprint where terrain already raises the dragged tool
const HOVER_MARGIN = 0.5

// X coordinate of the outer tip for each half, per movement tool type
const MOVE_TIP = { short: 1.574, medium: 2.523, long: 3.535 }
// Movement tools are about 0.56" wide (mesh-a spans z = ±0.279)
const MOVE_HALF_WIDTH = 0.279
// A movement tool bends at its hinge, but never past a right angle, the same as the plastic one
const MAX_BEND = Math.PI / 2
// Place sits this far in from the tip, and so does Throw at the other end. On a movement tool, these
// buttons are turned across the tool, so along the tool they take only their height, about 0.27" for
// Place and 0.4" for Throw.
const PLACE_INSET = 0.75

// A tool has two halves, one on each side of its center: right is local +X, left is local −X.
// On a movement tool the center is the hinge.
const SIDES = ['right', 'left']
const OTHER = { right: 'left', left: 'right' }
// How far each half is turned around the center from straight, as a yaw
const STRAIGHT = { right: 0, left: 0 }
// The angle tool is always bent to a right angle, the same on both sides
const ANGLE_TURN = { right: Math.PI / 4, left: -Math.PI / 4 }
// A movement tool snapped to the base of an angle tool points at most this far from the middle of the angle
const ANGLE_LIMIT = Math.PI / 4

// Player tints, from the tools in the mod (3036795456). Every tool there has the same black and white
// texture (TOOLBOX_IMAGE_02) and a ColorDiffuse in its player's color. TTS multiplies the texture by it.
const TOOL_TINT = { blue: [0.12, 0.53, 1], red: [0.86, 0.1, 0.09] }

// team: 'blue' or 'red' for a player's tint. Without it, the texture keeps its own colors.
function textured(obj, map, team) {
  const color = new THREE.Color().setRGB(...(TOOL_TINT[team] ?? [1, 1, 1]), THREE.SRGBColorSpace)
  const mat = new THREE.MeshStandardMaterial({ map, color, roughness: 0.5, metalness: 0.1 })
  obj.traverse(child => { if (child.isMesh) child.material = mat })
  return obj
}

// Vertex positions of the mesh in obj, for a convex hull collider
function hullPoints(obj) {
  let points = null
  obj.traverse(child => { if (child.isMesh && !points) points = child.geometry.attributes.position.array })
  return points
}

// Yaw θ points along world (cos θ, 0, −sin θ). THREE.js Y-rotation by θ maps local +X there.
function yawQuat(yaw) {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }
}

// Yaw of the direction from a to b (XZ)
function yawTo(a, b) {
  return Math.atan2(a.z - b.z, b.x - a.x)
}

// The same angle, in −π..π
function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

const poseEuler = new THREE.Euler(0, 0, 0, 'YXZ')
const poseQuat = new THREE.Quaternion()

// Tool center on the table (XZ) and yaw
function toolPose(rb) {
  const t = rb.translation()
  const r = rb.rotation()
  poseEuler.setFromQuaternion(poseQuat.set(r.x, r.y, r.z, r.w))
  return { x: t.x, z: t.z, yaw: poseEuler.y }
}

// Tool center and the yaw of each half, pointing out from the center
function toolShape(pose, turn) {
  return { x: pose.x, z: pose.z, right: pose.yaw + turn.right, left: pose.yaw + turn.left + Math.PI }
}

// Point on the center line of one half, dist from the tool center
function alongHalf(shape, side, dist) {
  const yaw = shape[side]
  return { x: shape.x + dist * Math.cos(yaw), z: shape.z - dist * Math.sin(yaw) }
}

// The half whose end (length from the tool center) is nearer to point p
function nearerHalf(shape, length, p) {
  const [rightEnd, leftEnd] = SIDES.map(side => alongHalf(shape, side, length))
  return Math.hypot(rightEnd.x - p.x, rightEnd.z - p.z) <= Math.hypot(leftEnd.x - p.x, leftEnd.z - p.z) ? 'right' : 'left'
}

// Pose turned by yaw d around pivot, as one rigid piece
function turnAround(pose, pivot, d) {
  const ox = pose.x - pivot.x, oz = pose.z - pivot.z
  const c = Math.cos(d), s = Math.sin(d)
  return { x: pivot.x + ox * c + oz * s, z: pivot.z - ox * s + oz * c, yaw: pose.yaw + d }
}

// World XZ → local XZ of a pose (inverse of the yaw rotation)
function toLocal(pose, p) {
  const dx = p.x - pose.x, dz = p.z - pose.z
  const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw)
  return { x: dx * c - dz * s, z: dx * s + dz * c }
}

// Local XZ of a pose → world XZ (inverse of toLocal)
function fromLocal(pose, l) {
  const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw)
  return { x: pose.x + l.x * c + l.z * s, z: pose.z - l.x * s + l.z * c }
}

// Range 1 (see README "Tools"): the tool lies across the line from the base, and its width measures
// range 1. Returns the tool center for this yaw, so that the base (center c) touches the long side
// `across` (±1: local ±Z) at the corner of the end `end` (±1: local ±X).
function cornerSnapCenter(c, radius, yaw, tip, halfWidth, end, across) {
  const o = fromLocal({ x: 0, z: 0, yaw }, { x: end * tip, z: across * (halfWidth + radius) })
  return { x: c.x - o.x, z: c.z - o.z }
}

// Which corner of the tool the base (center c) is at: the end and the long side nearer to it
function nearerCorner(pose, c) {
  const l = toLocal(pose, c)
  return { end: l.x >= 0 ? 1 : -1, across: l.z >= 0 ? 1 : -1 }
}

// Edge-to-edge gap between a round base and the footprint: a rectangle for each half and the
// round hinge between them. The ends stay flat (not a capsule). Gap ≤ 0 means the base touches it.
function footprintGap(shape, length, halfWidth, center, radius) {
  let gap = Math.hypot(center.x - shape.x, center.z - shape.z) - halfWidth
  for (const side of SIDES) {
    const l = toLocal({ x: shape.x, z: shape.z, yaw: shape[side] }, center)
    const ox = l.x - THREE.MathUtils.clamp(l.x, 0, length)
    const oz = l.z - THREE.MathUtils.clamp(l.z, -halfWidth, halfWidth)
    gap = Math.min(gap, Math.hypot(ox, oz))
  }
  return gap - radius
}

// Nearest point to p where a round base with its center there touches the footprint (gap ≤ 0 in
// footprintGap). p itself when the base already touches it. Each piece of the footprint, grown by the
// radius, is convex, so the nearest point is the nearest of the nearest points on each piece.
function nearestTouching(shape, length, halfWidth, p, radius) {
  // The round hinge
  const reach = halfWidth + radius
  const d = Math.hypot(p.x - shape.x, p.z - shape.z)
  if (d <= reach) return p
  let best = { x: shape.x + (p.x - shape.x) * reach / d, z: shape.z + (p.z - shape.z) * reach / d }
  let bestGap = d - reach
  // The rectangle of each half
  for (const side of SIDES) {
    const pose = { x: shape.x, z: shape.z, yaw: shape[side] }
    const l = toLocal(pose, p)
    const q = { x: THREE.MathUtils.clamp(l.x, 0, length), z: THREE.MathUtils.clamp(l.z, -halfWidth, halfWidth) }
    const out = Math.hypot(l.x - q.x, l.z - q.z)
    if (out <= radius) return p
    if (out - radius < bestGap) {
      bestGap = out - radius
      best = fromLocal(pose, { x: q.x + (l.x - q.x) * radius / out, z: q.z + (l.z - q.z) * radius / out })
    }
  }
  return best
}

// Tool pose with the end of the left half touching the base edge. The tool points from the base
// along yaw. Without a yaw, it points toward the mat center, so it stays on the mat.
function snapPose(center, radius, halfLength, yaw) {
  const len = Math.hypot(center.x, center.z)
  const dir = yaw ?? (len > 0.01 ? yawTo(center, { x: 0, z: 0 }) : 0)
  const along = radius + halfLength
  return { x: center.x + along * Math.cos(dir), z: center.z - along * Math.sin(dir), yaw: dir }
}

// Angle tool (README "Toward / Away"): pose of the tool bent 90° so that both arms touch the base
// (center c). The angle opens along openYaw, from the hinge toward the base. The arm center lines
// are d / √2 from the base center, and the arm is halfWidth wide, so d = √2 (radius + halfWidth).
function anglePose(c, radius, halfWidth, openYaw) {
  const d = Math.SQRT2 * (radius + halfWidth)
  return { x: c.x - d * Math.cos(openYaw), z: c.z + d * Math.sin(openYaw), yaw: openYaw - Math.PI / 2 }
}

// Angle tool pose aimed at point p: the line from the base center to p goes through the hinge.
// Away: the hinge is between the base and p. Toward: the hinge is on the other side of the base.
function aimPose(c, radius, halfWidth, p, mode) {
  const u = yawTo(c, p)
  return anglePose(c, radius, halfWidth, mode === 'away' ? u + Math.PI : u)
}

// Turn d (yaw) of a movement tool around the base center, cut so that its move direction stays
// within ANGLE_LIMIT of openYaw. moveYaw: the move direction before the turn.
function limitTurn(moveYaw, openYaw, d) {
  const diff = wrapAngle(moveYaw - openYaw)
  return THREE.MathUtils.clamp(diff + d, -ANGLE_LIMIT, ANGLE_LIMIT) - diff
}

// Range 1: tool pose with the base at the corner of the left end, and the tool on the side of the
// base toward the mat center, so it stays on the mat. The long sides are across the line from the
// base to the mat center.
function snapPoseOne(center, radius, halfLength, halfWidth) {
  const len = Math.hypot(center.x, center.z)
  const dx = len > 0.01 ? -center.x / len : 1
  const dz = len > 0.01 ? -center.z / len : 0
  // Local +Z points away from the mat center, so the base is on the +Z long side
  const yaw = Math.atan2(-dx, -dz)
  return { ...cornerSnapCenter(center, radius, yaw, halfLength, halfWidth, -1, 1), yaw }
}

// Throw / Push on a straight tool (README "Throw / Push"): the base center moves along the middle line,
// from touching the end of half `side` from outside to touching the other end from outside, the same
// as Place. The line follows that half, so it stays straight when the other half is bent.
// Returns { start, dir, distance }: start point (table XZ), unit XZ direction and full distance.
function throwLine(shape, side, tip, radius) {
  const yaw = shape[side] + Math.PI
  return { start: alongHalf(shape, side, tip + radius), dir: { x: Math.cos(yaw), z: -Math.sin(yaw) }, distance: 2 * (tip + radius) }
}

// Returns groundY(x, z, yaw): top of the table or terrain under the whole footprint of the tool
// with its center at (x, z), or null when nothing is under it.
// halfLength: length of each half. turn: how far each half is turned from straight.
function useFootprintGround(halfLength, halfWidth, turn) {
  const { world, rapier } = useRapier()
  // One box for each half. Larger than the half, so the tool rises before it reaches terrain
  // and a tiny overlap at the edge does not switch it between heights
  const halfShape = useMemo(
    () => new rapier.Cuboid(halfLength / 2 + HOVER_MARGIN, FOOTPRINT_CAST_HALF_H, halfWidth + HOVER_MARGIN),
    [rapier, halfLength, halfWidth],
  )

  return function groundY(x, z, yaw) {
    const shape = toolShape({ x, z, yaw }, turn)
    let top = null
    for (const side of SIDES) {
      const c = alongHalf(shape, side, halfLength / 2)
      const y = castDown(world, rapier, halfShape, yawQuat(shape[side]), c.x, c.z, FOOTPRINT_CAST_HALF_H)
      if (y !== null && (top === null || y > top)) top = y
    }
    return top
  }
}

// Whole-body drag: click body to select, drag when selected.
// onPointerDown(e, selected, onSelect, plan): plan() is called once when a drag starts (not on a
// plain click). It returns null for a move, or { pivot, onTurn, onPointer } for a turn:
// - Move: the tool follows the pointer. onDragMove(raycaster) is called on each pointer move, with a
//   raycaster set to the pointer ray. When it returns true, the drag ends there and the rest of that
//   press does nothing.
// - Turn: the pointer turns around pivot (table XZ), and onTurn(d, startPose) returns the tool pose
//   for a turn of d (yaw) since the drag started. onPointer(raycaster) is called on each pointer
//   move with a raycaster set to the pointer ray, and with null when the drag ends.
// In both, the tool stays hoverHeight above the table or terrain under its footprint (from groundY),
// as a dragged model does. onDragStart(kind): called once when a drag starts, with 'move' or 'turn'.
// onDragEnd: called once when a drag ends, also when onDragMove ends it.
function useDragTool(rigidRef, groundY, hoverHeight, onDragStart, onDragMove, onDragEnd) {
  const { camera, gl, controls } = useThree()
  const isDragging = useRef(false)
  const mouseNDC = useRef({ x: 0, y: 0 })
  const restType = useRef(0)
  const raycaster = useRef(new THREE.Raycaster())
  // Horizontal plane through the grabbed point, so the pointer stays on the same spot of the tool
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  // Grabbed point minus body center (XZ), so the tool does not jump to center on the pointer
  const grabOffset = useRef({ x: 0, z: 0 })
  // Turn drag: the plan, with startPose, startAngle (yaw from the pivot to the grabbed point) and
  // pose, the next kinematic pose { x, z, yaw }. Y follows the ground. null for a move drag.
  const turning = useRef(null)

  useFrame((_, dt) => {
    const rb = rigidRef.current
    if (!isDragging.current || !rb) return
    const t = rb.translation()
    let pose = turning.current?.pose
    if (!pose) {
      // The plane stays at the grab height. If it followed the tool, raising the tool would move
      // the pointer hit off the terrain, the tool would drop, and it would shake between heights.
      raycaster.current.setFromCamera(mouseNDC.current, camera)
      const target = new THREE.Vector3()
      if (!raycaster.current.ray.intersectPlane(dragPlane.current, target)) return
      pose = { x: target.x - grabOffset.current.x, z: target.z - grabOffset.current.z, yaw: toolPose(rb).yaw }
    }
    const { x, z, yaw } = pose
    // Off the table there is no ground, so keep the current height
    const ground = groundY(x, z, yaw)
    const y = ground === null ? t.y : t.y + (ground + hoverHeight - t.y) * Math.min(1, dt * HOVER_RATE)
    // A sleeping body keeps moving but its mesh is not synced, so keep it awake
    rb.wakeUp()
    rb.setNextKinematicTranslation({ x, y, z })
    if (turning.current) rb.setNextKinematicRotation(yawQuat(yaw))
  })

  return function onPointerDown(e, selected, onSelect, plan) {
    // Only the left button moves a piece. A right or middle drag goes to OrbitControls (the camera).
    if (e.button !== 0) return
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const pointerId = e.pointerId ?? e.nativeEvent?.pointerId
    const grab = { x: e.point.x, z: e.point.z }
    if (controls) controls.enabled = false
    if (rigidRef.current) {
      const t = rigidRef.current.translation()
      dragPlane.current.constant = -e.point.y
      grabOffset.current = { x: e.point.x - t.x, z: e.point.z - t.z }
    }
    if (pointerId !== undefined && gl.domElement.hasPointerCapture?.(pointerId)) {
      gl.domElement.releasePointerCapture(pointerId)
    }

    // The drag was ended by onDragMove
    let ended = false

    function endDrag() {
      isDragging.current = false
      turning.current?.onPointer?.(null)
      turning.current = null
      rigidRef.current?.setBodyType(restType.current, true)
      onDragEnd?.()
    }

    const onMove = (ev) => {
      if (ev.pointerId !== pointerId || ended) return
      if (!isDragging.current) {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        const rb = rigidRef.current
        if (!selected || !rb || Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        restType.current = rb.bodyType()
        rb.setBodyType(2, true)
        isDragging.current = true
        const turn = plan?.() ?? null
        if (turn) {
          const startPose = toolPose(rb)
          turning.current = { ...turn, startPose, startAngle: yawTo(turn.pivot, grab), pose: startPose }
        }
        onDragStart?.(turn ? 'turn' : 'move')
      }
      const rect = gl.domElement.getBoundingClientRect()
      mouseNDC.current = {
        x: ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((ev.clientY - rect.top) / rect.height) * 2 + 1,
      }
      raycaster.current.setFromCamera(mouseNDC.current, camera)
      const turn = turning.current
      if (turn) {
        turn.onPointer?.(raycaster.current)
        const hit = raycaster.current.ray.intersectPlane(dragPlane.current, new THREE.Vector3())
        if (!hit || Math.hypot(hit.x - turn.pivot.x, hit.z - turn.pivot.z) < 0.01) return
        turn.pose = turn.onTurn(wrapAngle(yawTo(turn.pivot, hit) - turn.startAngle), turn.startPose)
        return
      }
      if (onDragMove?.(raycaster.current)) {
        ended = true
        endDrag()
      }
    }

    const onUp = (ev) => {
      if (ev.pointerId !== pointerId) return
      if (isDragging.current) endDrag()
      else if (!ended) onSelect?.()
      if (controls) controls.enabled = true
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
}

export const RANGE_TIP = { 2: 1.501, 3: 3.0, 4: 4.0, 5: 5.0 }
// Range tools are 1" wide (mesh spans z = ±0.5)
const RANGE_HALF_WIDTH = 0.5
const FOOTPRINT_COLOR = '#3f7fd6'
const FOOTPRINT_TOUCH = '#2ee06a'
const FOOTPRINT_APART = '#e5484d'
// Physics can nudge a resting base a little, so a small gap still counts as contact
const CONTACT_EPS = 0.01

// The same character or token. The tool model objects are made again when the pieces change.
export function sameModel(a, b) {
  return a.kind === b.kind && a.id === b.id
}

// Range 1, edge to edge seen from above, between the bases of models a and b. The tool width
// (2 * halfWidth) is range 1.
function withinRangeOne(a, b, halfWidth) {
  const ca = a.getCenter()
  const cb = b.getCenter()
  return Math.hypot(ca.x - cb.x, ca.z - cb.z) - a.radius - b.radius <= 2 * halfWidth + CONTACT_EPS
}

// The same mark: both null, or the same piece with the same mode
function sameMark(a, b) {
  return a?.kind === b?.kind && a?.id === b?.id && a?.mode === b?.mode
}

// Range tool: the piece that a turn of the snapped tool measures against gets a green or red outline
// (see SelectionOutlines.jsx). measuredRef: the piece under the pointer while a drag turns the snapped
// tool around the base, else null (set in Tool). In range:
// - Range 2 to 5: the measured base touches the footprint.
// - R1 (rangeOne): the measured base is within range 1 of the snapped base.
// onChange(mark): called when the mark changes, with { kind, id, mode: 'inRange' | 'outOfRange' },
// or with null. The tool turns on every frame of a drag, so the mark is found on every frame.
function RangeMark({ rigidRef, turn, halfLength, halfWidth, rangeOne, snap, measuredRef, onChange }) {
  // The mark of the last onChange call
  const last = useRef(null)

  // A removed tool marks nothing. Scene passes a state setter, so onChange stays the same function.
  useEffect(() => () => onChange(null), [])

  useFrame(() => {
    const model = measuredRef.current
    let mark = null
    if (model && snap && rigidRef.current) {
      const reached = rangeOne
        ? withinRangeOne(snap.target, model, halfWidth)
        : footprintGap(toolShape(toolPose(rigidRef.current), turn), halfLength, halfWidth, model.getCenter(), model.radius) <= CONTACT_EPS
      mark = { kind: model.kind, id: model.id, mode: reached ? 'inRange' : 'outOfRange' }
    }
    if (sameMark(mark, last.current)) return
    last.current = mark
    onChange(mark)
  })

  return null
}

// The tool's footprint straight below the tool, painted by the table and terrain
// materials on every surface under it that faces up (see footprintProjection.js).
// Follows the body's XZ position and yaw, and the turn of each half. With a target base
// it turns green when the base touches it and red when it does not.
// rangeFrom: on the range 1 tool while snapped, the snapped model, else null. Then, for another
// target, green means the target base is within range 1 of the snapped base (edge to edge, seen
// from above). Touching is not enough there, because the long sides go across the line.
function ToolFootprint({ rigidRef, turn, halfLength, halfWidth, selected, target, rangeFrom }) {
  const slotRef = useRef(null)

  useEffect(() => {
    slotRef.current = acquireFootprint()
    return () => {
      slotRef.current?.release()
      slotRef.current = null
    }
  }, [])

  useFrame(() => {
    if (!rigidRef.current || !slotRef.current) return
    const shape = toolShape(toolPose(rigidRef.current), turn)

    // Set colors here, not through React state, because contact changes every frame during a drag
    const center = selected && target?.getCenter()
    let fill = FOOTPRINT_COLOR
    if (center) {
      const reached = rangeFrom && !sameModel(rangeFrom, target)
        ? withinRangeOne(rangeFrom, target, halfWidth)
        : footprintGap(shape, halfLength, halfWidth, center, target.radius) <= CONTACT_EPS
      fill = reached ? FOOTPRINT_TOUCH : FOOTPRINT_APART
    }
    const line = center ? fill : selected ? '#ffffff' : FOOTPRINT_COLOR
    slotRef.current.set(shape, halfLength, halfWidth, fill, selected ? 0.35 : 0.2, line)
  })

  return null
}

// target: the piece selected last, a model or a token, as { id, kind, getObject, getCenter, radius,
// getBody? }, or null. The tool measures against it. By default it also snaps to it when it spawns
// (spawnTarget in Tool). getBody is only there for a model (a character). placeTarget: the selected character in the same form, or null.
// Place moves it, and is disabled without it. models: every character and token, in the same form,
// for the pointer raycast and the snap. onSnap(model): the tool snapped to that model during a drag.
// onPlaceLimit(limit): called with { id, clamp(p) } while Place is on and a character is selected,
// and with null after. clamp moves a drag point p (table XZ) of that character, so its base keeps
// touching the footprint. On the R1 tool only Place 2 does this. Place 1 moves the character once.
// onSpawn: called once, when the tool is created
// team: 'blue' or 'red', the player tint of the tool
// hoverHeight: how far above the table or terrain the tool hangs while dragged
// number 1: range 1 has no tool of its own. As with "Snap 1" in the TTS mod, the Range 2 tool lies
// across the line from the base, and its 1" width measures range 1. See README "Tools".
export function RangeRuler({ number = 2, team, ...props }) {
  const rangeOne = number === 1
  const mesh = rangeOne ? 2 : number
  const raw = useLoader(OBJLoader, assetUrl(`tools/range-${mesh}-mesh.obj`))
  const map = useTexture(TEXTURE)
  const parts = useMemo(() => [{ obj: textured(raw.clone(), map, team) }], [raw, map, team])
  return <Tool parts={parts} tip={RANGE_TIP[mesh] ?? 1.501} halfWidth={RANGE_HALF_WIDTH} rangeOne={rangeOne} {...props} />
}

// Non-interactive R3 tool that follows a dragged model along the deployment edge.
// Visible only while a model is being dragged with the deploy-line toggle on.
// team: the dragged model's team, so the tool has that player's tint.
export function DeployRangeTool({ getBody, centerZ, yaw, team, hoverHeight = 1 }) {
  const raw = useLoader(OBJLoader, assetUrl('tools/range-3-mesh.obj'))
  const map = useTexture(TEXTURE)
  const obj = useMemo(() => textured(raw.clone(), map, team), [raw, map, team])
  const groupRef = useRef()
  const slotRef = useRef(null)
  const groundY = useFootprintGround(RANGE_TIP[3], RANGE_HALF_WIDTH, STRAIGHT)
  // Height of the tool, or null before the first frame
  const yRef = useRef(null)

  useEffect(() => {
    slotRef.current = acquireFootprint()
    return () => {
      slotRef.current?.release()
      slotRef.current = null
    }
  }, [])

  useFrame((_, dt) => {
    const body = getBody()
    if (!body || !groupRef.current) return
    const { x } = body.translation()
    // hoverHeight above the table or terrain under the footprint, the same as a dragged tool.
    // Off the table there is no ground, so keep the current height.
    const ground = groundY(x, centerZ, yaw)
    if (ground !== null) {
      const goal = ground + hoverHeight
      yRef.current = yRef.current === null ? goal : yRef.current + (goal - yRef.current) * Math.min(1, dt * HOVER_RATE)
    }
    groupRef.current.position.set(x, yRef.current ?? hoverHeight, centerZ)
    groupRef.current.rotation.y = yaw
    if (slotRef.current) {
      const shape = { x, z: centerZ, right: yaw, left: yaw + Math.PI }
      slotRef.current.set(shape, RANGE_TIP[3], RANGE_HALF_WIDTH, FOOTPRINT_COLOR, 0.25, FOOTPRINT_COLOR)
    }
  })

  return (
    <group ref={groupRef}>
      <primitive object={obj} />
    </group>
  )
}

// The meshes of a movement tool: mesh-a is the right half with the round hinge, mesh-b is the left half
function useMovementParts(type, team) {
  const rawA = useLoader(OBJLoader, assetUrl(`tools/${type}-movement-mesh-a.obj`))
  const rawB = useLoader(OBJLoader, assetUrl(`tools/${type}-movement-mesh-b.obj`))
  const map = useTexture(TEXTURE)
  return useMemo(
    () => [{ obj: textured(rawA.clone(), map, team), side: 'right' }, { obj: textured(rawB.clone(), map, team), side: 'left' }],
    [rawA, rawB, map, team],
  )
}

// Movement tool: mesh-a is the right half with the round hinge, mesh-b is the left half
export function MovementRuler({ type = 'short', team, ...props }) {
  const parts = useMovementParts(type, team)
  return <Tool parts={parts} tip={MOVE_TIP[type] ?? 1.574} halfWidth={MOVE_HALF_WIDTH} bendable {...props} />
}

// Angle tool, for Toward / Away: a copy of the long movement tool, always bent to a right angle.
// See README "Toward / Away".
export function AngleRuler({ team, ...props }) {
  const parts = useMovementParts('long', team)
  return <Tool parts={parts} tip={MOVE_TIP.long} halfWidth={MOVE_HALF_WIDTH} angle {...props} />
}

const BUTTON_STYLE = {
  background: '#1a1a1a',
  border: '1px solid #f5a623',
  color: '#f5a623',
  cursor: 'pointer',
  fontFamily: 'sans-serif',
  pointerEvents: 'auto',
}

// Html element flat on the tool at local x, facing up. Html stays inside RigidBody,
// so it follows the body's transform automatically.
// Without a CSS rotation, the element reads toward local −X, with its top toward local +Z.
function FlatHtml({ x = 0, z = 0, children }) {
  return (
    // Rx(π/2) lays the Html element flat on the tool's XZ surface facing up.
    // Without this the element stands perpendicular to the table.
    <group position={[x, 0.25, z]} rotation={[Math.PI / 2, Math.PI, 0]}>
      <Html center transform>{children}</Html>
    </group>
  )
}

// drei's Html transform draws 1 CSS px as 1/40 world unit (see DiceKeys.jsx)
const PX_PER_INCH = 40
// Share of the tool width that Place covers
const PLACE_FILL = 0.85

// Place, Place 1, Place 2, Throw and Toward / Away.
// toolWidth: width of the tool in inches. The button is 1" long before the scale, so the scale is the
// length in inches: 0.47" on a movement tool, 0.85" on a range tool.
// on: the toggle state, or undefined for the one-shot Place 1 on the R1 tool
// along: on the R1 tool, Place lies along the tool instead of across it. See the transform below.
// rotation: the CSS rotation in degrees, for a button that is not across or along. Reads toward local
// −X with 0, and toward local +X with 180.
function ToolButton({ label = 'Place', toolWidth, on, along = false, rotation, disabled = false, disabledTitle = 'Select a character', title, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      style={{
        ...BUTTON_STYLE,
        background: on ? '#f5a623' : '#1a1a1a',
        color: on ? '#1a1a1a' : '#f5a623',
        width: PX_PER_INCH,
        padding: '4px 0',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontSize: '11px',
        whiteSpace: 'nowrap',
        // Across the tool, reading toward the tool's local +Z. A tool snapped to a model on the
        // player's half points to the mat center (snapPose), so the label reads from the player's side.
        // Along: reading toward local +X, with its top toward local −Z. The R1 tool snapped to a model
        // on the player's half has local +Z away from the mat center (snapPoseOne), so the same holds.
        transform: `rotate(${rotation ?? (along ? 180 : -90)}deg) scale(${PLACE_FILL * toolWidth})`,
      }}
      disabled={disabled}
      title={disabled ? disabledTitle : title}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

// Round toggle with a half circle that has an arrow at each end. About as big as the hinge.
function BendButton({ on, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label="Bend"
      title={on ? 'Bend on: dragging a half turns it around the hinge' : 'Bend'}
      style={{
        ...BUTTON_STYLE,
        background: on ? '#f5a623' : '#1a1a1a',
        color: on ? '#1a1a1a' : '#f5a623',
        width: '22px',
        height: '22px',
        padding: 0,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClick}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 15 A7 7 0 0 1 19 15" />
        <path d="M2 12 L5 15.5 L8 12 M16 12 L19 15.5 L22 12" />
      </svg>
    </button>
  )
}

// Tool that measures with its footprint. See README "Tools".
// parts: [{ obj, side }], the meshes of the tool. A part with a side turns with that half.
// tip: X of each end (length of each half of the footprint).
// bendable: a movement tool. Its halves turn around the hinge at the center.
// rangeOne: the range 1 tool. It snaps with a corner, not an end. See README "Tools", "Range 1".
// onRangeMark(mark): the piece that a turn of the snapped tool measures against, see RangeMark. Only
// the range tools pass it. Without it, the tool marks no pieces.
// onHover(over): the pointer moved onto (true) or off (false) the tool. onDrag(on): a drag of the
// tool started (true) or ended (false). Both are also called with false on unmount.
// turnRef(turn): gets turnAroundCenter, for Q / E (see turnPiece in Scene.jsx), and null on unmount.
// spawnTarget: the piece the tool snaps to when it spawns, target by default. Without one it spawns
// free at position.
// angle: the angle tool. It starts bent 90° and cannot bend, place or throw. It spawns aimed at aim
// (a model) or at the mat center.
// angleRef(get): gets a function that returns { target, openYaw } while the angle tool is snapped, else
// null, and null on unmount. angleLimit(model): on a movement tool, the openYaw of the angle tool
// snapped to that model, else null. The movement tool then keeps its move direction within
// ANGLE_LIMIT of it, while snapped to that model. Read at each use, because the angle tool can move.
function Tool({ parts, tip, halfWidth, bendable = false, rangeOne = false, angle = false, aim = null, angleLimit, angleRef, position = [0, 0, 0], hoverHeight = 1, selected = false, onSelect, target, spawnTarget = target, placeTarget, models = [], onSnap, onPlaceLimit, onSpawn, onRangeMark, onHover, onDrag, turnRef }) {
  const [hovered, setHovered] = useState(false)
  const rigidRef = useRef()
  // The tool meshes, for the outline
  const partsRef = useRef()
  // Stays STRAIGHT on a tool that is not bendable, and ANGLE_TURN on the angle tool
  const [turn, setTurn] = useState(angle ? ANGLE_TURN : STRAIGHT)
  // Angle tool: where the hinge goes when the tool aims at a piece
  const [mode, setMode] = useState('away')
  // While the bend button is on, a drag on a half turns that half instead of the whole tool
  const [bendOn, setBendOn] = useState(false)
  // Snapped: { target, side, across }, the model the tool is snapped to and the half whose end touches
  // its base. across (R1 tool only): the long side (±1: local ±Z) that the base touches.
  // Free: null. See README "Tools".
  const [snap, setSnap] = useState(null)
  // While Place is on: the end where Place put the selected character. The Place button stays there.
  // Off: null. While Place is on, a drag of the selected character keeps its base touching the footprint.
  const [placeSide, setPlaceSide] = useState(null)
  const placing = selected && placeSide !== null && !!placeTarget
  // Place moves the character to the far end, the end that does not touch the snapped base. A free
  // tool has no far end, so Place is shown there only while it is on, so that it can be turned off.
  const placeButtonSide = placeSide ?? (snap ? OTHER[snap.side] : null)
  // While Throw is on: { side, target }, the end the Throw started from and the thrown character. The
  // Throw button stays at that end. Off: null. While Throw is on, a drag of the thrown character keeps
  // its base center on the middle line of the tool (throwLine), so the player can correct the stop.
  // Place and Throw are never on at the same time: each one hides the other's button.
  const [throwLock, setThrowLock] = useState(null)
  const throwing = selected && throwLock !== null
  // Model under the pointer at the last move of a body drag, or null. undefined before the first move.
  // The tool snaps when the pointer moves onto a model, not when the drag starts on one.
  const overRef = useRef(undefined)
  // Model under the pointer while a drag turns the snapped tool around the base, else null. See RangeMark.
  const measuredRef = useRef(null)
  // The drag in progress: 'move', 'turn' or null. See useDragTool.
  const dragKind = useRef(null)
  const groundY = useFootprintGround(tip, halfWidth, turn)
  const onPointerDown = useDragTool(rigidRef, groundY, hoverHeight, kind => {
    // Only a free tool moves (see dragPlan)
    if (kind === 'move') overRef.current = undefined
    dragChange(kind)
  }, onDragMove, () => dragChange(null))
  const { world, rapier } = useRapier()
  const hulls = useMemo(() => parts.map(part => hullPoints(part.obj)), [parts])

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
    const rb = rigidRef.current
    if (!rb) return null
    if (bendable && bendOn && side && side !== snap?.side) {
      const { x, z } = toolPose(rb)
      const other = turn[OTHER[side]]
      return {
        pivot: { x, z },
        onTurn(d, pose) {
          setTurn({ ...turn, [side]: THREE.MathUtils.clamp(turn[side] + d, other - MAX_BEND, other + MAX_BEND) })
          return pose
        },
      }
    }
    if (!snap) return null
    // The piece under the pointer is the one the tool measures against. Not the snapped one.
    const { target: snapped, side: snappedSide } = snap
    const pivot = snapped.getCenter()
    return {
      pivot,
      onTurn(d, pose) {
        // Angle tool over another piece: the line through its center, not a plain turn
        if (angle && measuredRef.current) return aimPose(pivot, snapped.radius, halfWidth, measuredRef.current.getCenter(), mode)
        const open = angleLimit?.(snapped) ?? null
        if (open === null) return turnAround(pose, pivot, d)
        // A movement tool at an angle tool: the turn changes the move direction by d, so cut d
        return turnAround(pose, pivot, limitTurn(toolShape(pose, turn)[snappedSide] + Math.PI, open, d))
      },
      onPointer(raycaster) {
        const model = raycaster && modelUnder(raycaster)
        measuredRef.current = model && !sameModel(model, snapped) ? model : null
      },
    }
  }

  // Q / E: turns the whole tool by angle (yaw) around its center, the hinge on a movement tool.
  // Scene.jsx calls it on every frame of a smoothed turn. The tool keeps its bend. Both ends move,
  // so a snapped tool is free after the turn. A tool that is not dragged then hangs hoverHeight
  // above the ground under its new outline (a move drag already does this on every frame). A turn
  // drag sets the pose on every frame, so a turn during it does nothing.
  function turnAroundCenter(angle) {
    const rb = rigidRef.current
    if (!rb || dragKind.current === 'turn') return
    const { x, z, yaw } = toolPose(rb)
    if (!dragKind.current) {
      const ground = groundY(x, z, yaw + angle)
      if (ground !== null) rb.setTranslation({ x, y: ground + hoverHeight, z }, true)
    }
    rb.setRotation(yawQuat(yaw + angle), true)
    setSnap(null)
  }

  // Registered on every render, so the turn reads the current state
  useEffect(() => {
    turnRef?.(turnAroundCenter)
    return () => turnRef?.(null)
  })

  useEffect(() => {
    if (!angle) return undefined
    angleRef?.(() => {
      const rb = rigidRef.current
      return snap && rb ? { target: snap.target, openYaw: toolPose(rb).yaw + Math.PI / 2 } : null
    })
    return () => angleRef?.(null)
  })

  // The cleanups also run on unmount, so a removed tool does not stay hovered or dragged. Escape
  // removes the selected tool, also during its drag.
  useEffect(() => {
    if (!hovered) return undefined
    onHover?.(true)
    return () => onHover?.(false)
  }, [hovered])
  useEffect(() => () => onDrag?.(false), [])
  // A click selects the tool. Only a selected tool moves by a drag.
  useHoverCursor(hovered, selected ? 'grab' : 'pointer')

  // Nearest of the models (default: all of them) under the pointer ray (figure or base), or null
  function modelUnder(raycaster, list = models) {
    let nearest = null
    let nearestDistance = Infinity
    for (const model of list) {
      const object = model.getObject()
      const hit = object && raycaster.intersectObject(object, true)[0]
      if (hit && hit.distance < nearestDistance) {
        nearest = model
        nearestDistance = hit.distance
      }
    }
    return nearest
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
    const rb = rigidRef.current
    if (!c || !rb) return false
    const pose = toolPose(rb)
    if (angle) {
      // Same direction, moved so that both arms touch the base
      const { x, z } = anglePose(c, model.radius, halfWidth, pose.yaw + Math.PI / 2)
      const ground = groundY(x, z, pose.yaw)
      rb.setTranslation({ x, y: ground === null ? rb.translation().y : ground + hoverHeight, z }, true)
      setSnap({ target: model, side: 'left' })
      return true
    }
    let center, side, across
    if (rangeOne) {
      const corner = nearerCorner(pose, c)
      across = corner.across
      center = cornerSnapCenter(c, model.radius, pose.yaw, tip, halfWidth, corner.end, across)
      side = corner.end > 0 ? 'right' : 'left'
    } else {
      const shape = toolShape(pose, turn)
      side = nearerHalf(shape, tip, c)
      // The base center is past the end of that half, so the tool center is that far back from it
      const back = tip + model.radius
      center = { x: c.x - back * Math.cos(shape[side]), z: c.z + back * Math.sin(shape[side]) }
    }
    let placed = { x: center.x, z: center.z, yaw: pose.yaw }
    // At an angle tool, the move direction (away from the base) stays in range: turn the tool around the base
    const open = angleLimit?.(model) ?? null
    if (open !== null && !rangeOne) {
      const moveYaw = toolShape(pose, turn)[side] + Math.PI
      placed = turnAround(placed, c, limitTurn(moveYaw, open, 0))
    }
    const { x, z } = placed
    const ground = groundY(x, z, placed.yaw)
    rb.setTranslation({ x, y: ground === null ? rb.translation().y : ground + hoverHeight, z }, true)
    if (placed.yaw !== pose.yaw) rb.setRotation(yawQuat(placed.yaw), true)
    setSnap({ target: model, side, across })
    return true
  }

  // Spawned with a spawnTarget: start snapped to it, not at the default position
  useEffect(() => {
    onSpawn?.()
    const center = spawnTarget?.getCenter()
    const rb = rigidRef.current
    if (!center || !rb) return
    // snapPoseOne puts the base on the +Z long side
    setSnap({ target: spawnTarget, side: 'left', across: 1 })
    // The angle tool aims at the aim piece, or at the mat center. A movement tool at an angle tool points along it.
    const pose = angle ? aimPose(center, spawnTarget.radius, halfWidth, aim?.getCenter() ?? { x: 0, z: 0 }, 'away')
      : rangeOne ? snapPoseOne(center, spawnTarget.radius, tip, halfWidth)
      : snapPose(center, spawnTarget.radius, tip, angleLimit?.(spawnTarget))
    const ground = groundY(pose.x, pose.z, pose.yaw) ?? 0
    rb.setTranslation({ x: pose.x, y: ground + hoverHeight, z: pose.z }, true)
    rb.setRotation(yawQuat(pose.yaw), true)
    // Only at spawn. Selecting another character later must not move the tool.
  }, [])

  // The snapped piece left the table (a removed character, a token that a character took), so the
  // tool is free. Else a drag would turn the tool around a point where the piece is no longer.
  useEffect(() => {
    if (snap && !models.some(model => sameModel(model, snap.target))) setSnap(null)
  }, [snap, models])

  useOutline(partsRef, outlineMode(selected, hovered))

  // The clamp reads the tool pose at each call, so the tool can move while Place is on
  useEffect(() => {
    if (!placing) return undefined
    const { id, radius } = placeTarget
    onPlaceLimit?.({
      id,
      clamp(p) {
        if (!rigidRef.current) return
        const spot = nearestTouching(toolShape(toolPose(rigidRef.current), turn), tip, halfWidth, p, radius)
        p.x = spot.x
        p.z = spot.z
      },
    })
    return () => onPlaceLimit?.(null)
  }, [placing, placeTarget, turn, tip, halfWidth])

  // The clamp reads the tool pose at each call, so the tool can move while Throw is on
  useEffect(() => {
    if (!throwing) return undefined
    const { side, target } = throwLock
    onPlaceLimit?.({
      id: target.id,
      clamp(p) {
        if (!rigidRef.current) return
        const { start, dir, distance } = throwLine(toolShape(toolPose(rigidRef.current), turn), side, tip, target.radius)
        const d = THREE.MathUtils.clamp((p.x - start.x) * dir.x + (p.z - start.z) * dir.z, 0, distance)
        p.x = start.x + dir.x * d
        p.z = start.z + dir.z * d
      },
    })
    return () => onPlaceLimit?.(null)
  }, [throwing, throwLock, turn, tip])

  // Angle tool, snapped: move the tool to the other side of the base, the same angle turned half
  // around. Toward becomes Away and Away becomes Toward.
  function handleMirror(e) {
    e.stopPropagation()
    const rb = rigidRef.current
    if (!snap || !rb) return
    const c = snap.target.getCenter()
    const pose = anglePose(c, snap.target.radius, halfWidth, toolPose(rb).yaw + Math.PI / 2 + Math.PI)
    const ground = groundY(pose.x, pose.z, pose.yaw)
    rb.setTranslation({ x: pose.x, y: ground === null ? rb.translation().y : ground + hoverHeight, z: pose.z }, true)
    rb.setRotation(yawQuat(pose.yaw), true)
    setMode(m => m === 'away' ? 'toward' : 'away')
  }

  // Move a model's base center to spot (table XZ)
  function moveBase(model, spot) {
    const body = model.getBody()
    if (!body) return
    const t = body.translation()
    // Put the base on top of the table or terrain at the spot. Keeping the old height
    // would leave the model inside terrain that is higher than where it started.
    const ground = baseGroundY(world, rapier, spot.x, spot.z, model.radius)
    body.setTranslation({ x: spot.x, y: ground ?? t.y, z: spot.z }, true)
    // Upright, as if picked up and put down there, even when the model had tipped over
    body.setRotation(upright(body.rotation()), true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  }

  // Turning Place on moves the selected character past the far end, so its base touches that end
  // from outside. Turning it off does not move anything.
  function togglePlace(e) {
    e.stopPropagation()
    if (placeSide) {
      setPlaceSide(null)
      return
    }
    if (!snap || !placeTarget || !rigidRef.current || throwLock) return
    const side = OTHER[snap.side]
    moveBase(placeTarget, alongHalf(toolShape(toolPose(rigidRef.current), turn), side, tip + placeTarget.radius))
    // The snapped model now touches the far end, so the tool stays snapped to it at that end.
    // The R1 tool snaps with a corner. The base is no longer at a corner, so the tool is free.
    if (sameModel(snap.target, placeTarget)) setSnap(rangeOne ? null : { target: snap.target, side })
    setPlaceSide(side)
  }

  // Range 1 tool, snapped: move the selected character across the tool, so its base touches the other
  // long side at the same corner. Its base edge is then 1" (the tool width) from the snapped base edge.
  // If it is the snapped model, it now touches the other long side, so the tool stays snapped to it.
  function handlePlaceOne(e) {
    e.stopPropagation()
    if (!snap || !placeTarget || !rigidRef.current) return
    const end = snap.side === 'right' ? 1 : -1
    moveBase(placeTarget, fromLocal(toolPose(rigidRef.current), { x: end * tip, z: -snap.across * (halfWidth + placeTarget.radius) }))
    if (sameModel(snap.target, placeTarget)) setSnap({ ...snap, across: -snap.across })
  }

  // Throw / Push (README "Throw / Push") turns on and off. Turning it on slides the snapped character
  // along the middle line of the tool, from the snapped end toward the far end. It stops at the first
  // character base, terrain piece or mat edge on the way (see throwPath.js). A lifted character does
  // not stop it, so the player lifts a character that the move should pass. The rules use a straight
  // tool, so a bent tool is straightened first: the far half lines up with the snapped half, and the
  // snapped end stays on the base. Turning Throw off does not move anything.
  function handleThrow(e) {
    e.stopPropagation()
    if (throwLock) {
      setThrowLock(null)
      return
    }
    const model = snap?.target
    const rb = rigidRef.current
    if (!model?.getBody?.() || !rb || placeSide) return
    const far = OTHER[snap.side]
    const straight = { [snap.side]: turn[snap.side], [far]: turn[snap.side] }
    setTurn(straight)
    const { start, dir, distance } = throwLine(toolShape(toolPose(rb), straight), snap.side, tip, model.radius)
    const others = models
      .filter(other => other.kind === 'character' && !sameModel(other, model) && other.getBody() && !other.isLifted())
      .map(other => ({ center: other.getCenter(), radius: other.radius }))
    const { moved, at } = throwMove(world, rapier, { start, dir, distance, radius: model.radius, others })
    const { path, duration } = throwSlide(at, distance, moved)
    model.slide(path, duration)
    // After the full move the base touches the far end, so the tool stays snapped to it there.
    // A base that stopped on the way touches no end, so the tool is free.
    setSnap(moved >= distance ? { target: model, side: far } : null)
    setThrowLock({ side: snap.side, target: model })
  }

  return (
    <>
      {/* Held in the air like a real tool over terrain: kinematic, so it does not fall,
          and a sensor, so models pass under it. The footprint below is what measures. */}
      <RigidBody ref={rigidRef} type="kinematicPosition" position={position} colliders={false} sensor>
        <group ref={partsRef}>
          {parts.map(part => (
            <group key={part.obj.uuid} rotation-y={partTurn(part)}>
              <primitive
                object={part.obj}
                onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
                onPointerOut={() => setHovered(false)}
                onPointerDown={(e) => onPointerDown(e, selected, onSelect, () => dragPlan(part.side))}
              />
            </group>
          ))}
        </group>
        {/* Not automatic colliders: those are made once from the meshes, so they would not turn with a half */}
        {parts.map((part, i) => (
          <ConvexHullCollider key={part.obj.uuid} args={[hulls[i]]} rotation={[0, partTurn(part), 0]} />
        ))}
        {SIDES.map(side => (
          <group key={side} rotation-y={turn[side]}>
            {/* Place toggle, Place 2 on the R1 tool. It cannot be turned on for a token: a token
                has no body, so there is no base to keep on the tool. */}
            {selected && !angle && side === placeButtonSide && !throwLock && (
              <FlatHtml x={side === 'right' ? tip - PLACE_INSET : PLACE_INSET - tip}>
                <ToolButton
                  label={rangeOne ? 'Place 2' : 'Place'}
                  toolWidth={halfWidth * 2}
                  along={rangeOne}
                  on={placeSide !== null}
                  disabled={placeSide === null && !placeTarget}
                  title={placeSide !== null ? 'Place on: the selected character stays touching the tool' : 'Move the selected character to this end, and keep it on the tool'}
                  onClick={togglePlace}
                />
              </FlatHtml>
            )}
            {/* Throw / Push toggle of a movement tool: at the snapped end, and while it is on, at the end
                the Throw started from. Not while Place is on: Place can put the snapped model at this
                end, and then its button is here. Disabled for a token: it has no body, so there is
                nothing to move. */}
            {selected && bendable && (throwLock ? side === throwLock.side : snap && placeSide === null && side === snap.side) && (
              <FlatHtml x={side === 'right' ? tip - PLACE_INSET : PLACE_INSET - tip}>
                <ToolButton
                  label={<>Throw<br />Push</>}
                  toolWidth={halfWidth * 2}
                  on={throwLock !== null}
                  disabled={!throwLock && !snap.target.getBody}
                  disabledTitle="Snap the tool to a character"
                  title={throwLock ? 'Throw on: the thrown character stays on the middle line of the tool'
                    : 'Throw or push the snapped character along the middle of the tool. It stops at the first character or terrain on the way.'}
                  onClick={handleThrow}
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
              label={<>Toward<br />Away</>}
              toolWidth={halfWidth * 2}
              rotation={mode === 'away' ? 0 : 180}
              title="Move the tool to the other side of the base, to switch between Toward and Away"
              onClick={handleMirror}
            />
          </FlatHtml>
        )}
        {selected && bendable && (
          <FlatHtml>
            <BendButton on={bendOn} onClick={(e) => { e.stopPropagation(); setBendOn(on => !on) }} />
          </FlatHtml>
        )}
        {/* R1 tool: Place 1 is at the snapped end, on the half of the long side where it moves the
            character. Only while snapped, as in the TTS mod: without a snapped model, there is no
            corner to measure from. Disabled for a token: it has no body, so there is nothing to move. */}
        {selected && rangeOne && snap && (
          <FlatHtml x={snap.side === 'right' ? tip - PLACE_INSET : PLACE_INSET - tip} z={-snap.across * halfWidth / 2}>
            <ToolButton
              label="Place 1"
              toolWidth={halfWidth * 2}
              along
              disabled={!placeTarget}
              title="Move the selected character across the tool, range 1 from the snapped model"
              onClick={handlePlaceOne}
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
        rangeFrom={rangeOne ? snap?.target ?? null : null}
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
