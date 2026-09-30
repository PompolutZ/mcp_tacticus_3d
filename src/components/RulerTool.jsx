import { useLoader, useFrame, useThree } from '@react-three/fiber'
import { useTexture, Html } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { RigidBody, ConvexHullCollider, useRapier } from '@react-three/rapier'
import { useMemo, useRef, useState, useEffect } from 'react'
import * as THREE from 'three'
import { baseGroundY, upright } from './CharacterModel.jsx'
import { acquireFootprint } from './footprintProjection.js'
import { castDown } from '../physics.js'
import { assetUrl } from '../assets/index.js'

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
// Handle sphere at each end. Big enough to grab easily, but smaller than a movement tool is wide.
// Its center is a little above the top of the tool (about 0.17), so most of it shows.
const HANDLE_RADIUS = 0.2
const HANDLE_Y = 0.2
// Place on a movement tool sits this far in from the tip. Place is about 1.04" wide (40 px per inch),
// so on the short tool it fits between the bend button and the handle. Html is drawn over the 3D
// view, so where it covered the handle, the handle could not be grabbed.
const PLACE_INSET = 0.75

// A tool has two halves, one on each side of its center: right is local +X, left is local −X.
// On a movement tool the center is the hinge.
const SIDES = ['right', 'left']
const OTHER = { right: 'left', left: 'right' }
// How far each half is turned around the center from straight, as a yaw
const STRAIGHT = { right: 0, left: 0 }

function textured(obj, map) {
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.5, metalness: 0.1 })
  obj.traverse(child => { if (child.isMesh) child.material = mat })
  return obj
}

function applyEmissive(obj, color, intensity) {
  obj.traverse(child => {
    if (child.isMesh && child.material) {
      child.material.emissive?.set(color)
      child.material.emissiveIntensity = intensity
    }
  })
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

// Tool pose with the end of the left half touching the base edge. The tool points from the base
// toward the mat center, so it stays on the mat.
function snapPose(center, radius, halfLength) {
  const len = Math.hypot(center.x, center.z)
  const dx = len > 0.01 ? -center.x / len : 1
  const dz = len > 0.01 ? -center.z / len : 0
  const along = radius + halfLength
  return { x: center.x + dx * along, z: center.z + dz * along, yaw: Math.atan2(-dz, dx) }
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
// The tool stays hoverHeight above the table or terrain under its footprint (from groundY),
// as a dragged model does. onDragStart: called once when a drag starts (not on a plain click).
// onDragMove(raycaster): called on each pointer move of a drag, with a raycaster set to the pointer
// ray. When it returns true, the drag ends there and the rest of that press does nothing.
function useDragTool(rigidRef, groundY, hoverHeight, onDragStart, onDragMove) {
  const { camera, gl, controls } = useThree()
  const isDragging = useRef(false)
  const mouseNDC = useRef({ x: 0, y: 0 })
  const restType = useRef(0)
  const raycaster = useRef(new THREE.Raycaster())
  // Horizontal plane through the grabbed point, so the pointer stays on the same spot of the tool
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  // Grabbed point minus body center (XZ), so the tool does not jump to center on the pointer
  const grabOffset = useRef({ x: 0, z: 0 })

  useFrame((_, dt) => {
    const rb = rigidRef.current
    if (!isDragging.current || !rb) return
    const t = rb.translation()
    // The plane stays at the grab height. If it followed the tool, raising the tool would move
    // the pointer hit off the terrain, the tool would drop, and it would shake between heights.
    raycaster.current.setFromCamera(mouseNDC.current, camera)
    const target = new THREE.Vector3()
    if (!raycaster.current.ray.intersectPlane(dragPlane.current, target)) return
    const x = target.x - grabOffset.current.x
    const z = target.z - grabOffset.current.z
    // Off the table there is no ground, so keep the current height
    const ground = groundY(x, z, toolPose(rb).yaw)
    const y = ground === null ? t.y : t.y + (ground + hoverHeight - t.y) * Math.min(1, dt * HOVER_RATE)
    // A sleeping body keeps moving but its mesh is not synced, so keep it awake
    rb.wakeUp()
    rb.setNextKinematicTranslation({ x, y, z })
  })

  return function onPointerDown(e, selected, onSelect) {
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const pointerId = e.pointerId ?? e.nativeEvent?.pointerId
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

    const onMove = (ev) => {
      if (ev.pointerId !== pointerId || ended) return
      if (!isDragging.current) {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (!selected || Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        restType.current = rigidRef.current?.bodyType() ?? 0
        rigidRef.current?.setBodyType(2, true)
        isDragging.current = true
        onDragStart?.()
      }
      const rect = gl.domElement.getBoundingClientRect()
      mouseNDC.current = {
        x: ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((ev.clientY - rect.top) / rect.height) * 2 + 1,
      }
      raycaster.current.setFromCamera(mouseNDC.current, camera)
      if (onDragMove?.(raycaster.current)) {
        ended = true
        isDragging.current = false
        rigidRef.current?.setBodyType(restType.current, true)
      }
    }

    const onUp = (ev) => {
      if (ev.pointerId !== pointerId) return
      if (isDragging.current) {
        isDragging.current = false
        rigidRef.current?.setBodyType(restType.current, true)
      } else if (!ended) {
        onSelect?.()
      }
      if (controls) controls.enabled = true
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
}

// Handle drag: the pointer turns around a pivot, and onTurn(d, startPose) returns the tool pose
// for a turn of d (yaw) since the drag started. The tool stays hoverHeight above the table or
// terrain under its footprint (from groundY), the same as during a drag.
function useHandleDrag(rigidRef, groundY, hoverHeight) {
  const { camera, gl, controls } = useThree()
  const raycaster = useRef(new THREE.Raycaster())
  // Horizontal plane through the grabbed point, so the handle stays under the pointer
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  // Next kinematic pose { x, z, yaw }, or null when no handle is dragged. Y follows the ground.
  const target = useRef(null)

  useFrame((_, dt) => {
    const rb = rigidRef.current
    if (!rb || !target.current) return
    const { x, z, yaw } = target.current
    const t = rb.translation()
    // Off the table there is no ground, so keep the current height
    const ground = groundY(x, z, yaw)
    const y = ground === null ? t.y : t.y + (ground + hoverHeight - t.y) * Math.min(1, dt * HOVER_RATE)
    rb.wakeUp()
    rb.setNextKinematicTranslation({ x, y, z })
    rb.setNextKinematicRotation(yawQuat(yaw))
  })

  // Point on the drag plane under the pointer, or null
  function planeHit(ev) {
    const rect = gl.domElement.getBoundingClientRect()
    const ndc = {
      x: ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    }
    raycaster.current.setFromCamera(ndc, camera)
    return raycaster.current.ray.intersectPlane(dragPlane.current, new THREE.Vector3())
  }

  return function startHandleDrag(e, pivot, onTurn) {
    e.stopPropagation()
    const rb = rigidRef.current
    if (!rb) return
    dragPlane.current.constant = -e.point.y
    const start = planeHit(e)
    if (!start) return
    const pointerId = e.pointerId ?? e.nativeEvent?.pointerId
    if (controls) controls.enabled = false

    const startPose = toolPose(rb)
    const startAngle = yawTo(pivot, start)
    const restType = rb.bodyType()
    rb.setBodyType(2, true)
    target.current = startPose

    const onMove = (ev) => {
      if (ev.pointerId !== pointerId) return
      const hit = planeHit(ev)
      if (!hit || Math.hypot(hit.x - pivot.x, hit.z - pivot.z) < 0.01) return
      target.current = onTurn(wrapAngle(yawTo(pivot, hit) - startAngle), startPose)
    }

    const onUp = (ev) => {
      if (ev.pointerId !== pointerId) return
      target.current = null
      rigidRef.current?.setBodyType(restType, true)
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
function sameModel(a, b) {
  return a.kind === b.kind && a.id === b.id
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
      const from = rangeFrom && !sameModel(rangeFrom, target) && rangeFrom.getCenter()
      const reached = from
        // The tool width is range 1
        ? Math.hypot(center.x - from.x, center.z - from.z) - target.radius - rangeFrom.radius <= 2 * halfWidth + CONTACT_EPS
        : footprintGap(shape, halfLength, halfWidth, center, target.radius) <= CONTACT_EPS
      fill = reached ? FOOTPRINT_TOUCH : FOOTPRINT_APART
    }
    const line = center ? fill : selected ? '#ffffff' : FOOTPRINT_COLOR
    slotRef.current.set(shape, halfLength, halfWidth, fill, selected ? 0.35 : 0.2, line)
  })

  return null
}

// target: the selected model or token as { id, kind, getObject, getCenter, radius, getBody? }, or
// null. getBody is only there for a model (a character); Place uses it to move the piece, and is
// disabled without it. models: every character and token, in the same form, for the pointer
// raycast and the snap. onSnap(model): the tool snapped to that model during a drag.
// hoverHeight: how far above the table or terrain the tool hangs while dragged
// number 1: range 1 has no tool of its own. As with "Snap 1" in the TTS mod, the Range 2 tool lies
// across the line from the base, and its 1" width measures range 1. See README "Tools".
export function RangeRuler({ number = 2, ...props }) {
  const rangeOne = number === 1
  const mesh = rangeOne ? 2 : number
  const raw = useLoader(OBJLoader, assetUrl(`tools/range-${mesh}-mesh.obj`))
  const map = useTexture(TEXTURE)
  const parts = useMemo(() => [{ obj: textured(raw.clone(), map) }], [raw, map])
  return <Tool parts={parts} tip={RANGE_TIP[mesh] ?? 1.501} halfWidth={RANGE_HALF_WIDTH} rangeOne={rangeOne} {...props} />
}

// Non-interactive R3 tool that follows a dragged model along the deployment edge.
// Visible only while a model is being dragged with the deploy-line toggle on.
export function DeployRangeTool({ getBody, centerZ, yaw, hoverHeight = 1 }) {
  const raw = useLoader(OBJLoader, assetUrl('tools/range-3-mesh.obj'))
  const map = useTexture(TEXTURE)
  const obj = useMemo(() => textured(raw.clone(), map), [raw, map])
  const groupRef = useRef()
  const slotRef = useRef(null)

  useEffect(() => {
    slotRef.current = acquireFootprint()
    return () => {
      slotRef.current?.release()
      slotRef.current = null
    }
  }, [])

  useFrame(() => {
    const body = getBody()
    if (!body || !groupRef.current) return
    const { x } = body.translation()
    groupRef.current.position.set(x, hoverHeight, centerZ)
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

// Movement tool: mesh-a is the right half with the round hinge, mesh-b is the left half
export function MovementRuler({ type = 'short', ...props }) {
  const rawA = useLoader(OBJLoader, assetUrl(`tools/${type}-movement-mesh-a.obj`))
  const rawB = useLoader(OBJLoader, assetUrl(`tools/${type}-movement-mesh-b.obj`))
  const map = useTexture(TEXTURE)
  const parts = useMemo(
    () => [{ obj: textured(rawA.clone(), map), side: 'right' }, { obj: textured(rawB.clone(), map), side: 'left' }],
    [rawA, rawB, map],
  )
  return <Tool parts={parts} tip={MOVE_TIP[type] ?? 1.574} halfWidth={MOVE_HALF_WIDTH} bendable {...props} />
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
function FlatHtml({ x = 0, children }) {
  return (
    // Rx(π/2) lays the Html element flat on the tool's XZ surface facing up.
    // Without this the element stands perpendicular to the table.
    <group position={[x, 0.25, 0]} rotation={[Math.PI / 2, Math.PI, 0]}>
      <Html center transform>{children}</Html>
    </group>
  )
}

function PlaceButton({ disabled = false, disabledTitle = 'Select a character', onClick }) {
  return (
    <button
      type="button"
      style={{
        ...BUTTON_STYLE,
        padding: '4px 6px',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontSize: '11px',
        whiteSpace: 'nowrap',
      }}
      disabled={disabled}
      title={disabled ? disabledTitle : undefined}
      onClick={onClick}
    >
      Place
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
      title={on ? 'Bend on: a handle turns its half around the hinge' : 'Bend'}
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
function Tool({ parts, tip, halfWidth, bendable = false, rangeOne = false, position = [0, 0, 0], hoverHeight = 1, selected = false, onSelect, target, models = [], onSnap }) {
  const [hovered, setHovered] = useState(false)
  const rigidRef = useRef()
  // Stays STRAIGHT on a tool that is not bendable
  const [turn, setTurn] = useState(STRAIGHT)
  // While the bend button is on, a handle turns its half instead of the whole tool
  const [bendOn, setBendOn] = useState(false)
  const bending = bendable && selected && bendOn

  // Snapped: { target, side }, the model the tool is snapped to and the half whose end touches
  // its base. Free: null. See README "Tools".
  const [snap, setSnap] = useState(null)
  // Model under the pointer at the last move of a body drag, or null. undefined before the first move.
  // The tool snaps when the pointer moves onto a model, not when the drag starts on one.
  const overRef = useRef(undefined)
  const groundY = useFootprintGround(tip, halfWidth, turn)
  // Dragging the tool body makes it free
  const onPointerDown = useDragTool(rigidRef, groundY, hoverHeight, () => {
    setSnap(null)
    overRef.current = undefined
  }, onDragMove)
  const startHandleDrag = useHandleDrag(rigidRef, groundY, hoverHeight)
  const { world, rapier } = useRapier()
  const hulls = useMemo(() => parts.map(part => hullPoints(part.obj)), [parts])

  function partTurn(part) {
    return part.side ? turn[part.side] : 0
  }

  function onHandleDown(e, side) {
    const rb = rigidRef.current
    if (!rb) return
    if (bending) {
      // The end of a turned half leaves the base, so turning the snapped half makes the tool free
      if (snap?.side === side) setSnap(null)
      const other = turn[OTHER[side]]
      startHandleDrag(e, toolPose(rb), (d, pose) => {
        const next = THREE.MathUtils.clamp(turn[side] + d, other - MAX_BEND, other + MAX_BEND)
        setTurn({ ...turn, [side]: next })
        return pose
      })
      return
    }
    // Snapped: turn around the base center. The distance to the base does not change,
    // so the tool keeps touching the base. Free: turn around the end of the other half.
    const center = snap?.target.getCenter()
    const pivot = center ?? alongHalf(toolShape(toolPose(rb), turn), OTHER[side], tip)
    startHandleDrag(e, pivot, (d, pose) => turnAround(pose, pivot, d))
  }

  // Nearest model under the pointer ray (figure or base), or null
  function modelUnder(raycaster) {
    let nearest = null
    let nearestDistance = Infinity
    for (const model of models) {
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
    let center, side
    if (rangeOne) {
      const { end, across } = nearerCorner(pose, c)
      center = cornerSnapCenter(c, model.radius, pose.yaw, tip, halfWidth, end, across)
      side = end > 0 ? 'right' : 'left'
    } else {
      const shape = toolShape(pose, turn)
      side = nearerHalf(shape, tip, c)
      // The base center is past the end of that half, so the tool center is that far back from it
      const back = tip + model.radius
      center = { x: c.x - back * Math.cos(shape[side]), z: c.z + back * Math.sin(shape[side]) }
    }
    const { x, z } = center
    const ground = groundY(x, z, pose.yaw)
    rb.setTranslation({ x, y: ground === null ? rb.translation().y : ground + hoverHeight, z }, true)
    setSnap({ target: model, side })
    return true
  }

  // Spawned while a character or a token is selected: start snapped to it, not at the default position
  useEffect(() => {
    const center = target?.getCenter()
    const rb = rigidRef.current
    if (!center || !rb) return
    setSnap({ target, side: 'left' })
    const pose = rangeOne ? snapPoseOne(center, target.radius, tip, halfWidth) : snapPose(center, target.radius, tip)
    const ground = groundY(pose.x, pose.z, pose.yaw) ?? 0
    rb.setTranslation({ x: pose.x, y: ground + hoverHeight, z: pose.z }, true)
    rb.setRotation(yawQuat(pose.yaw), true)
    // Only at spawn. Selecting another character later must not move the tool.
  }, [])

  useEffect(() => {
    const color = selected ? '#f5a623' : hovered ? '#ffffff' : '#000000'
    const intensity = selected ? 0.6 : hovered ? 0.4 : 0
    parts.forEach(part => applyEmissive(part.obj, color, intensity))
  }, [parts, hovered, selected])

  // Move a model so its base touches the end of one half, outside the tool
  function placeAt(model, side) {
    if (!rigidRef.current) return
    placeOn(model, alongHalf(toolShape(toolPose(rigidRef.current), turn), side, tip + model.radius))
  }

  // Move a model's base center to spot (table XZ)
  function placeOn(model, spot) {
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

  // Range tool: move the selected character to the end farther from its base
  function handlePlace(e) {
    e.stopPropagation()
    const body = target?.getBody()
    if (!body || !rigidRef.current) return
    const shape = toolShape(toolPose(rigidRef.current), turn)
    placeAt(target, OTHER[nearerHalf(shape, tip, body.translation())])
  }

  // Range 1 tool, snapped: move the selected character across the tool, so its base touches the other
  // long side at the same corner. Its base edge is then 1" (the tool width) from the snapped base edge.
  // If it is the snapped model, it now touches the other long side, so the tool stays snapped to it.
  function handlePlaceOne(e) {
    e.stopPropagation()
    const c = snap?.target.getCenter()
    if (!c || !target?.getBody || !rigidRef.current) return
    const pose = toolPose(rigidRef.current)
    const { end, across } = nearerCorner(pose, c)
    placeOn(target, fromLocal(pose, { x: end * tip, z: -across * (halfWidth + target.radius) }))
  }

  // Movement tool: move the snapped model to the other end. The model then touches that end,
  // so the tool stays snapped to it at that end.
  function handleSnapPlace(e) {
    e.stopPropagation()
    const side = OTHER[snap.side]
    placeAt(snap.target, side)
    setSnap({ target: snap.target, side })
  }

  return (
    <>
      {/* Held in the air like a real tool over terrain: kinematic, so it does not fall,
          and a sensor, so models pass under it. The footprint below is what measures. */}
      <RigidBody ref={rigidRef} type="kinematicPosition" position={position} colliders={false} sensor>
        {parts.map(part => (
          <group key={part.obj.uuid} rotation-y={partTurn(part)}>
            <primitive
              object={part.obj}
              onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
              onPointerOut={() => setHovered(false)}
              onPointerDown={(e) => onPointerDown(e, selected, onSelect)}
            />
          </group>
        ))}
        {/* Not automatic colliders: those are made once from the meshes, so they would not turn with a half */}
        {parts.map((part, i) => (
          <ConvexHullCollider key={part.obj.uuid} args={[hulls[i]]} rotation={[0, partTurn(part), 0]} />
        ))}
        {SIDES.map(side => (
          <group key={side} rotation-y={turn[side]}>
            <mesh position={[side === 'right' ? tip : -tip, HANDLE_Y, 0]} onPointerDown={(e) => onHandleDown(e, side)}>
              <sphereGeometry args={[HANDLE_RADIUS, 16, 12]} />
              <meshStandardMaterial color="#f5a623" roughness={0.3} metalness={0.5} />
            </mesh>
            {/* Movement tool: Place is at the end the model moves to, the end that is not snapped.
                Not shown for a token: it has no body, so there is nothing to move. */}
            {bendable && selected && snap && snap.side !== side && snap.target.getBody && (
              <FlatHtml x={side === 'right' ? tip - PLACE_INSET : PLACE_INSET - tip}>
                <PlaceButton onClick={handleSnapPlace} />
              </FlatHtml>
            )}
          </group>
        ))}
        {selected && (
          <FlatHtml>
            {bendable
              ? <BendButton on={bendOn} onClick={(e) => { e.stopPropagation(); setBendOn(on => !on) }} />
              // Disabled for a token: it has no body, so Place has nothing to move.
              // Range 1: only while snapped, as "Place 1" in the TTS mod. Without a snapped model,
              // there is no corner to measure from.
              : rangeOne
                ? <PlaceButton disabled={!snap || !target?.getBody} disabledTitle={snap ? 'Select a character' : 'Snap the tool to a model'} onClick={handlePlaceOne} />
                : <PlaceButton disabled={!target || !target.getBody} onClick={handlePlace} />}
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
    </>
  )
}
