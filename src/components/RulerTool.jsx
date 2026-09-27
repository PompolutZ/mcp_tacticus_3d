import { useLoader, useFrame, useThree } from '@react-three/fiber'
import { useTexture, Html } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { RigidBody, useRapier } from '@react-three/rapier'
import { useMemo, useRef, useState, useEffect } from 'react'
import * as THREE from 'three'
import { baseGroundY, upright } from './CharacterModel.jsx'
import { acquireFootprint } from './footprintProjection.js'
import { castDown } from '../physics.js'
import { assetUrl } from '../assets/index.js'

const TEXTURE = assetUrl('tools/toolbox-02.png')
const TABLE_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
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

// Returns groundY(x, z, rotation): top of the table or terrain under the whole footprint,
// or null when nothing is under it. hover: { halfLength, halfWidth }, or null.
function useFootprintGround(hover) {
  const { world, rapier } = useRapier()
  // Larger than the footprint, so the tool rises before it reaches terrain
  // and a tiny overlap at the edge does not switch it between heights
  const footprintShape = useMemo(
    () => hover && new rapier.Cuboid(hover.halfLength + HOVER_MARGIN, FOOTPRINT_CAST_HALF_H, hover.halfWidth + HOVER_MARGIN),
    [rapier, hover?.halfLength, hover?.halfWidth],
  )

  return function groundY(x, z, rotation) {
    return castDown(world, rapier, footprintShape, rotation, x, z, FOOTPRINT_CAST_HALF_H)
  }
}

// Whole-body drag: click body to select, drag when selected.
// hover: { halfLength, halfWidth, height } keeps the tool this high above the table or
// terrain under its footprint, as a dragged model does. Without it the tool keeps its height.
// onDragStart: called once when a drag starts (not on a plain click)
function useDragTool(rigidRef, hover, onDragStart) {
  const { camera, gl, controls } = useThree()
  const groundY = useFootprintGround(hover)
  const isDragging = useRef(false)
  const mouseNDC = useRef({ x: 0, y: 0 })
  const restY = useRef(0)
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
    let y = restY.current
    if (hover) {
      // Off the table there is no ground, so keep the current height
      const ground = groundY(x, z, rb.rotation())
      y = ground === null ? t.y : t.y + (ground + hover.height - t.y) * Math.min(1, dt * HOVER_RATE)
    }
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

    const onMove = (ev) => {
      if (ev.pointerId !== pointerId) return
      if (!isDragging.current) {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (!selected || Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        restY.current = rigidRef.current?.translation().y ?? 0.1
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
    }

    const onUp = (ev) => {
      if (ev.pointerId !== pointerId) return
      if (isDragging.current) {
        isDragging.current = false
        rigidRef.current?.setBodyType(restType.current, true)
      } else {
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

// Rotation around the OPPOSITE handle (pivot).
// On drag start, compute pivot = world pos of the opposite handle.
// Each frame: new body center = pivot + RANGE_TIP * normalize(mouse − pivot).
// Angle θ is derived from the direction (mouse − pivot), then applied as a quaternion.
//
// THREE.js Y-rotation maps local (+1,0,0) → world (cos θ, 0, −sin θ).
// Right handle dragged → pivot is the left handle → θ = atan2(−dz, dx)
// Left  handle dragged → pivot is the right handle → θ = atan2( dz,−dx)
const RANGE_TIP = { 2: 1.501, 3: 3.0, 4: 4.0, 5: 5.0 }
// Range tools are 1" wide (mesh spans z = ±0.5)
const RANGE_HALF_WIDTH = 0.5
const FOOTPRINT_COLOR = '#3f7fd6'
const FOOTPRINT_TOUCH = '#2ee06a'
const FOOTPRINT_APART = '#e5484d'
// Physics can nudge a resting base a little, so a small gap still counts as contact
const CONTACT_EPS = 0.01

const poseEuler = new THREE.Euler(0, 0, 0, 'YXZ')
const poseQuat = new THREE.Quaternion()

// Tool center on the table (XZ) and yaw. Yaw θ maps local +X to world (cos θ, 0, −sin θ).
function toolPose(rb) {
  const t = rb.translation()
  const r = rb.rotation()
  poseEuler.setFromQuaternion(poseQuat.set(r.x, r.y, r.z, r.w))
  return { x: t.x, z: t.z, yaw: poseEuler.y }
}

// World XZ → tool-local XZ (inverse of the yaw rotation)
function toLocal(pose, p) {
  const dx = p.x - pose.x, dz = p.z - pose.z
  const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw)
  return { x: dx * c - dz * s, z: dx * s + dz * c }
}

// Edge-to-edge gap between a round base and the footprint rectangle.
// The rectangle keeps flat ends (not a capsule). Gap ≤ 0 means the base touches it.
function footprintGap(pose, halfLength, halfWidth, center, radius) {
  const l = toLocal(pose, center)
  const ox = l.x - THREE.MathUtils.clamp(l.x, -halfLength, halfLength)
  const oz = l.z - THREE.MathUtils.clamp(l.z, -halfWidth, halfWidth)
  return Math.hypot(ox, oz) - radius
}

// Base center that puts the base edge on the middle of the footprint end
// farther from the base, so the model moves across the tool.
function landingSpot(pose, halfLength, center, radius) {
  const side = toLocal(pose, center).x >= 0 ? -1 : 1
  const along = side * (halfLength + radius)
  return { x: pose.x + along * Math.cos(pose.yaw), z: pose.z - along * Math.sin(pose.yaw) }
}

// Tool pose with one footprint end touching the base edge. The tool points from the base
// toward the mat center, so it stays on the mat. This is the pose after pressing Place, seen from the tool.
function snapPose(center, radius, halfLength) {
  const len = Math.hypot(center.x, center.z)
  const dx = len > 0.01 ? -center.x / len : 1
  const dz = len > 0.01 ? -center.z / len : 0
  const along = radius + halfLength
  return { x: center.x + dx * along, z: center.z + dz * along, yaw: Math.atan2(-dz, dx) }
}

// The tool's rectangle straight below the tool, painted by the table and terrain
// materials on every surface under it that faces up (see footprintProjection.js).
// Follows the body's XZ position and yaw only. With a target base it turns green when
// the base touches it and red when it does not.
function ToolFootprint({ rigidRef, halfLength, halfWidth, selected, target }) {
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
    const pose = toolPose(rigidRef.current)

    // Set colors here, not through React state, because contact changes every frame during a drag
    const body = selected && target?.getBody()
    let fill = FOOTPRINT_COLOR
    if (body) {
      const touching = footprintGap(pose, halfLength, halfWidth, body.translation(), target.radius) <= CONTACT_EPS
      fill = touching ? FOOTPRINT_TOUCH : FOOTPRINT_APART
    }
    const line = body ? fill : selected ? '#ffffff' : FOOTPRINT_COLOR
    slotRef.current.set(pose, halfLength, halfWidth, fill, selected ? 0.35 : 0.2, line)
  })

  return null
}

// hover: { halfLength, halfWidth, height } keeps the tool this high above the table or
// terrain under its footprint while it rotates, the same as during a drag
function useRotateHandle(rigidRef, tip, hover) {
  const { camera, gl, controls } = useThree()
  const groundY = useFootprintGround(hover)
  const raycaster = useRef(new THREE.Raycaster())
  const isRotating = useRef(false)
  const isRight = useRef(false)
  const pivot = useRef(null)        // world-space XZ of the fixed opposite handle
  const targetT = useRef(null)      // next kinematic XZ translation; Y follows the ground
  const targetR = useRef(null)      // next kinematic rotation (quaternion)

  useFrame((_, dt) => {
    const rb = rigidRef.current
    if (!isRotating.current || !rb || !targetT.current || !targetR.current) return
    const { x, z } = targetT.current
    const t = rb.translation()
    // Off the table there is no ground, so keep the current height
    const ground = groundY(x, z, targetR.current)
    const y = ground === null ? t.y : t.y + (ground + hover.height - t.y) * Math.min(1, dt * HOVER_RATE)
    rb.wakeUp()
    rb.setNextKinematicTranslation({ x, y, z })
    rb.setNextKinematicRotation(targetR.current)
  })

  // Table point under the pointer, or null
  function tableHit(ev) {
    const rect = gl.domElement.getBoundingClientRect()
    const ndc = {
      x: ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    }
    raycaster.current.setFromCamera(ndc, camera)
    return raycaster.current.ray.intersectPlane(TABLE_PLANE, new THREE.Vector3())
  }

  // snapBody: base of the model the tool is snapped to, or null when the tool is free
  return function startRotate(e, rightHandle, snapBody) {
    e.stopPropagation()
    if (!rigidRef.current) return
    const pointerId = e.pointerId ?? e.nativeEvent?.pointerId
    if (controls) controls.enabled = false

    const t = rigidRef.current.translation()
    const r = rigidRef.current.rotation()
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w)
    isRight.current = rightHandle

    // Snapped: orbit around the base center. The tool turns by the same angle as the pointer
    // turns around the base, so the tool-to-base offset only rotates and the tool keeps touching the base.
    let orbit = null
    const start = snapBody && tableHit(e)
    if (start) {
      const c = snapBody.translation()
      orbit = {
        c,
        offset: { x: t.x - c.x, z: t.z - c.z },
        yaw: toolPose(rigidRef.current).yaw,
        angle: Math.atan2(start.z - c.z, start.x - c.x),
      }
    } else {
      // Opposite handle local position: right drag → opposite is left (−tip,0,0)
      const oppLocal = new THREE.Vector3(rightHandle ? -tip : tip, 0, 0)
      oppLocal.applyQuaternion(q)
      pivot.current = { x: t.x + oppLocal.x, z: t.z + oppLocal.z }
    }

    const restType = rigidRef.current.bodyType()
    rigidRef.current.setBodyType(2, true)
    isRotating.current = true

    const onMove = (ev) => {
      if (ev.pointerId !== pointerId) return
      const hit = tableHit(ev)
      if (!hit) return

      if (orbit) {
        const { c, offset } = orbit
        if (Math.hypot(hit.x - c.x, hit.z - c.z) < 0.01) return
        // δ turns +X toward +Z. Yaw turns +X toward −Z, so yaw changes by −δ.
        const d = Math.atan2(hit.z - c.z, hit.x - c.x) - orbit.angle
        const cos = Math.cos(d), sin = Math.sin(d)
        targetT.current = {
          x: c.x + offset.x * cos - offset.z * sin,
          z: c.z + offset.x * sin + offset.z * cos,
        }
        const half = (orbit.yaw - d) / 2
        targetR.current = { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }
        return
      }
      if (!pivot.current) return

      const dx = hit.x - pivot.current.x
      const dz = hit.z - pivot.current.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < 0.01) return

      // Body center stays at tip distance from the pivot in the mouse direction
      const nx = dx / dist, nz = dz / dist
      targetT.current = { x: pivot.current.x + tip * nx, z: pivot.current.z + tip * nz }

      const theta = isRight.current ? Math.atan2(-dz, dx) : Math.atan2(dz, -dx)
      const half = theta / 2
      targetR.current = { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }
    }

    const onUp = (ev) => {
      if (ev.pointerId !== pointerId) return
      isRotating.current = false
      pivot.current = null
      targetT.current = null
      targetR.current = null
      rigidRef.current?.setBodyType(restType, true)
      if (controls) controls.enabled = true
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
}

// target: the selected character as { getBody, radius }, or null
// hoverHeight: how far above the table or terrain the tool hangs while dragged
export function RangeRuler({ number = 2, ...props }) {
  const raw = useLoader(OBJLoader, assetUrl(`tools/range-${number}-mesh.obj`))
  const map = useTexture(TEXTURE)
  const objs = useMemo(() => [textured(raw.clone(), map)], [raw, map])
  return <StraightTool objs={objs} tip={RANGE_TIP[number] ?? 1.501} halfWidth={RANGE_HALF_WIDTH} {...props} />
}

// Movement tool kept straight (no bend yet), so it behaves the same as a range tool
export function MovementRuler({ type = 'short', ...props }) {
  const rawA = useLoader(OBJLoader, assetUrl(`tools/${type}-movement-mesh-a.obj`))
  const rawB = useLoader(OBJLoader, assetUrl(`tools/${type}-movement-mesh-b.obj`))
  const map = useTexture(TEXTURE)
  const objs = useMemo(
    () => [textured(rawA.clone(), map), textured(rawB.clone(), map)],
    [rawA, rawB, map],
  )
  return <StraightTool objs={objs} tip={MOVE_TIP[type] ?? 1.574} halfWidth={MOVE_HALF_WIDTH} {...props} />
}

// Straight tool that measures with its footprint. See README "Tools".
// objs: meshes of the tool. tip: X of each end (footprint half length).
function StraightTool({ objs, tip, halfWidth, position = [0, 0, 0], hoverHeight = 1, selected = false, onSelect, target }) {
  const [hovered, setHovered] = useState(false)
  const rigidRef = useRef()
  const handleGroupRef = useRef()
  const hover = useMemo(
    () => ({ halfLength: tip, halfWidth, height: hoverHeight }),
    [tip, halfWidth, hoverHeight],
  )

  // Snapped: getBody of the model the tool is snapped to. Free: null. See README "Tools".
  const snapRef = useRef(null)
  // Dragging the tool body makes it free
  const onPointerDown = useDragTool(rigidRef, hover, () => { snapRef.current = null })
  const startRotate = useRotateHandle(rigidRef, tip, hover)
  const groundY = useFootprintGround(hover)
  const { world, rapier } = useRapier()

  function onHandleDown(e, rightHandle) {
    startRotate(e, rightHandle, snapRef.current?.() ?? null)
  }

  // Spawned while a character is selected: start snapped to its base, not at the default position
  useEffect(() => {
    const body = target?.getBody()
    const rb = rigidRef.current
    if (!body || !rb) return
    snapRef.current = target.getBody
    const pose = snapPose(body.translation(), target.radius, tip)
    const rotation = { x: 0, y: Math.sin(pose.yaw / 2), z: 0, w: Math.cos(pose.yaw / 2) }
    const ground = groundY(pose.x, pose.z, rotation) ?? 0
    rb.setTranslation({ x: pose.x, y: ground + hoverHeight, z: pose.z }, true)
    rb.setRotation(rotation, true)
    // Only at spawn. Selecting another character later must not move the tool.
  }, [])

  // Sync handle group to the physics body so handles follow without being colliders
  useFrame(() => {
    if (!rigidRef.current || !handleGroupRef.current) return
    const t = rigidRef.current.translation()
    const r = rigidRef.current.rotation()
    handleGroupRef.current.position.set(t.x, t.y, t.z)
    handleGroupRef.current.quaternion.set(r.x, r.y, r.z, r.w)
  })

  useEffect(() => {
    const color = selected ? '#f5a623' : hovered ? '#ffffff' : '#000000'
    const intensity = selected ? 0.6 : hovered ? 0.4 : 0
    objs.forEach(obj => applyEmissive(obj, color, intensity))
  }, [objs, hovered, selected])

  // Move the selected character so its base touches the far end of the footprint
  function handlePlace(e) {
    e.stopPropagation()
    const body = target?.getBody()
    if (!body || !rigidRef.current) return
    const t = body.translation()
    const spot = landingSpot(toolPose(rigidRef.current), tip, t, target.radius)
    // Put the base on top of the table or terrain at the spot. Keeping the old height
    // would leave the model inside terrain that is higher than where it started.
    const ground = baseGroundY(world, rapier, spot.x, spot.z, target.scale)
    body.setTranslation({ x: spot.x, y: ground ?? t.y, z: spot.z }, true)
    // Upright, as if picked up and put down there, even when the model had tipped over
    body.setRotation(upright(body.rotation()), true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  }

  return (
    <>
      {/* Held in the air like a real tool over terrain: kinematic, so it does not fall,
          and a sensor, so models pass under it. The footprint below is what measures. */}
      <RigidBody ref={rigidRef} type="kinematicPosition" position={position} colliders="hull" sensor>
        {objs.map(obj => (
          <primitive
            key={obj.uuid}
            object={obj}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
            onPointerOut={() => setHovered(false)}
            onPointerDown={(e) => onPointerDown(e, selected, onSelect)}
          />
        ))}
        {/* Html stays inside RigidBody so it follows the body's transform automatically */}
        {selected && (
          // Rx(π/2) lays the Html element flat on the tool's XZ surface facing up.
          // Without this the element stands perpendicular to the table.
          <group position={[0, 0.25, 0]} rotation={[Math.PI / 2, Math.PI, 0]}>
            <Html center transform>
              <button
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #f5a623',
                  color: '#f5a623',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  cursor: target ? 'pointer' : 'not-allowed',
                  opacity: target ? 1 : 0.4,
                  fontSize: '11px',
                  fontFamily: 'sans-serif',
                  pointerEvents: 'auto',
                  whiteSpace: 'nowrap',
                }}
                disabled={!target}
                title={target ? undefined : 'Select a character first'}
                onClick={handlePlace}
              >
                Place
              </button>
            </Html>
          </group>
        )}
      </RigidBody>
      <ToolFootprint rigidRef={rigidRef} halfLength={tip} halfWidth={halfWidth} selected={selected} target={target} />
      {/* Handles outside RigidBody — purely visual, no physics collider */}
      <group ref={handleGroupRef}>
        <mesh position={[tip, 0.15, 0]} onPointerDown={(e) => onHandleDown(e, true)}>
          <sphereGeometry args={[0.12, 12, 8]} />
          <meshStandardMaterial color="#f5a623" roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh position={[-tip, 0.15, 0]} onPointerDown={(e) => onHandleDown(e, false)}>
          <sphereGeometry args={[0.12, 12, 8]} />
          <meshStandardMaterial color="#f5a623" roughness={0.3} metalness={0.5} />
        </mesh>
      </group>
    </>
  )
}
