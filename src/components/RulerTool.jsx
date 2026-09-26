import { useLoader, useFrame, useThree } from '@react-three/fiber'
import { useTexture, Html } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { RigidBody } from '@react-three/rapier'
import { useMemo, useRef, useState, useEffect } from 'react'
import * as THREE from 'three'

const TEXTURE = '/tools/toolbox-02.png'
const TABLE_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const DRAG_THRESHOLD = 4

// X coordinate of the outer tip for each half, per ruler type
const RULER_TIP = { short: 1.574, medium: 2.523, long: 3.535 }

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

// Whole-body drag: click body to select, drag when selected
function useDragTool(rigidRef) {
  const { camera, gl, controls } = useThree()
  const isDragging = useRef(false)
  const mouseNDC = useRef({ x: 0, y: 0 })
  const restY = useRef(0)
  const restType = useRef(0)
  const raycaster = useRef(new THREE.Raycaster())
  // Horizontal plane through the grabbed point, so the pointer stays on the same spot of the tool
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  // Grabbed point minus body center (XZ), so the tool does not jump to center on the pointer
  const grabOffset = useRef({ x: 0, z: 0 })

  useFrame(() => {
    if (!isDragging.current || !rigidRef.current) return
    raycaster.current.setFromCamera(mouseNDC.current, camera)
    const target = new THREE.Vector3()
    if (raycaster.current.ray.intersectPlane(dragPlane.current, target)) {
      // A sleeping body keeps moving but its mesh is not synced, so keep it awake
      rigidRef.current.wakeUp()
      rigidRef.current.setNextKinematicTranslation({
        x: target.x - grabOffset.current.x,
        y: restY.current,
        z: target.z - grabOffset.current.z,
      })
    }
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

// Handle drag: rotates one half of the movement ruler around the center pivot
// isHandleA=true → mesh-a (positive X half), false → mesh-b (negative X half)
//
// THREE.js Y rotation transforms (x,0,z) as:
//   wx = x*cos(θ) + z*sin(θ),  wz = -x*sin(θ) + z*cos(θ)
// For mesh-a tip (tip, 0, 0): wx = tip*cos(angleA), wz = -tip*sin(angleA)
//   → angleA = -atan2(dz, dx)
// For mesh-b tip (-tip, 0, 0): wx = -tip*cos(angleB), wz = tip*sin(angleB)
//   → angleB = atan2(dz, -dx)
function useBendHandle(rigidRef) {
  const { camera, gl, controls } = useThree()
  const raycaster = useRef(new THREE.Raycaster())

  return function startBend(e, isHandleA, setAngle) {
    e.stopPropagation()
    const pointerId = e.pointerId ?? e.nativeEvent?.pointerId
    if (controls) controls.enabled = false

    const onMove = (ev) => {
      if (ev.pointerId !== pointerId || !rigidRef.current) return
      const bodyPos = rigidRef.current.translation()
      const rect = gl.domElement.getBoundingClientRect()
      const ndc = {
        x: ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((ev.clientY - rect.top) / rect.height) * 2 + 1,
      }
      raycaster.current.setFromCamera(ndc, camera)
      const hit = new THREE.Vector3()
      if (raycaster.current.ray.intersectPlane(TABLE_PLANE, hit)) {
        const dx = hit.x - bodyPos.x
        const dz = hit.z - bodyPos.z
        const raw = isHandleA ? -Math.atan2(dz, dx) : Math.atan2(dz, -dx)
        setAngle(Math.max(-Math.PI / 2, Math.min(Math.PI / 2, raw)))
      }
    }

    const onUp = (ev) => {
      if (ev.pointerId !== pointerId) return
      if (controls) controls.enabled = true
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
}

export function MovementRuler({ type = 'short', position = [0, 0, 0], selected = false, onSelect }) {
  const rawA = useLoader(OBJLoader, `/tools/${type}-movement-mesh-a.obj`)
  const rawB = useLoader(OBJLoader, `/tools/${type}-movement-mesh-b.obj`)
  const map = useTexture(TEXTURE)
  const [hovered, setHovered] = useState(false)
  const [angleA, setAngleA] = useState(0)
  const [angleB, setAngleB] = useState(0)
  const rigidRef = useRef()
  const handleGroupRef = useRef()
  const [objA, objB] = useMemo(
    () => [textured(rawA.clone(), map), textured(rawB.clone(), map)],
    [rawA, rawB, map],
  )
  const tip = RULER_TIP[type] ?? 1.574

  const onPointerDown = useDragTool(rigidRef)
  const startBend = useBendHandle(rigidRef)

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
    applyEmissive(objA, color, intensity)
    applyEmissive(objB, color, intensity)
  }, [objA, objB, hovered, selected])

  // Handle positions in body-local space derived from current bend angles
  // mesh-a tip: (tip·cos angleA, 0, −tip·sin angleA)
  // mesh-b tip: (−tip·cos angleB, 0, tip·sin angleB)
  const hAx = tip * Math.cos(angleA), hAz = -tip * Math.sin(angleA)
  const hBx = -tip * Math.cos(angleB), hBz = tip * Math.sin(angleB)

  return (
    <>
      <RigidBody ref={rigidRef} type="dynamic" position={position} colliders="hull" linearDamping={0.4} ccd lockRotations>
        <group rotation={[0, angleA, 0]}>
          <primitive
            object={objA}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
            onPointerOut={() => setHovered(false)}
            onPointerDown={(e) => onPointerDown(e, selected, onSelect)}
          />
        </group>
        <group rotation={[0, angleB, 0]}>
          <primitive
            object={objB}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
            onPointerOut={() => setHovered(false)}
            onPointerDown={(e) => onPointerDown(e, selected, onSelect)}
          />
        </group>
      </RigidBody>
      {/* Handles outside RigidBody — purely visual, no physics collider */}
      <group ref={handleGroupRef}>
        <mesh position={[hAx, 0.15, hAz]} onPointerDown={(e) => startBend(e, true, setAngleA)}>
          <sphereGeometry args={[0.12, 12, 8]} />
          <meshStandardMaterial color="#f5a623" roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh position={[hBx, 0.15, hBz]} onPointerDown={(e) => startBend(e, false, setAngleB)}>
          <sphereGeometry args={[0.12, 12, 8]} />
          <meshStandardMaterial color="#f5a623" roughness={0.3} metalness={0.5} />
        </mesh>
      </group>
    </>
  )
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
// Just above the mat (y = 0.01) so the footprint does not z-fight with it
const FOOTPRINT_Y = 0.015
const FOOTPRINT_COLOR = '#3f7fd6'
const noRaycast = () => null

// The tool's rectangle drawn flat on the mat, straight below the tool.
// Follows the body's XZ position and yaw only, so it stays on the table
// while the tool is held above it. Models are measured against this shape.
function ToolFootprint({ rigidRef, halfLength, halfWidth, selected }) {
  const groupRef = useRef()
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), [])
  const quat = useMemo(() => new THREE.Quaternion(), [])
  const edge = useMemo(() => new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-halfLength, 0, -halfWidth),
    new THREE.Vector3(halfLength, 0, -halfWidth),
    new THREE.Vector3(halfLength, 0, halfWidth),
    new THREE.Vector3(-halfLength, 0, halfWidth),
  ]), [halfLength, halfWidth])

  useFrame(() => {
    if (!rigidRef.current || !groupRef.current) return
    const t = rigidRef.current.translation()
    const r = rigidRef.current.rotation()
    euler.setFromQuaternion(quat.set(r.x, r.y, r.z, r.w))
    groupRef.current.position.set(t.x, FOOTPRINT_Y, t.z)
    groupRef.current.rotation.set(0, euler.y, 0)
  })

  return (
    <group ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast} renderOrder={1}>
        <planeGeometry args={[halfLength * 2, halfWidth * 2]} />
        <meshBasicMaterial color={FOOTPRINT_COLOR} transparent opacity={selected ? 0.35 : 0.2} depthWrite={false} />
      </mesh>
      <lineLoop geometry={edge} raycast={noRaycast} renderOrder={2}>
        <lineBasicMaterial color={selected ? '#ffffff' : FOOTPRINT_COLOR} depthWrite={false} />
      </lineLoop>
    </group>
  )
}

function useRotateHandle(rigidRef, tip) {
  const { camera, gl, controls } = useThree()
  const raycaster = useRef(new THREE.Raycaster())
  const isRotating = useRef(false)
  const isRight = useRef(false)
  const pivot = useRef(null)        // world-space XZ of the fixed opposite handle
  const pivotY = useRef(0)          // body Y height, kept constant during rotation
  const targetT = useRef(null)      // next kinematic translation
  const targetR = useRef(null)      // next kinematic rotation (quaternion)

  useFrame(() => {
    if (!isRotating.current || !rigidRef.current || !targetT.current || !targetR.current) return
    rigidRef.current.wakeUp()
    rigidRef.current.setNextKinematicTranslation(targetT.current)
    rigidRef.current.setNextKinematicRotation(targetR.current)
  })

  return function startRotate(e, rightHandle) {
    e.stopPropagation()
    if (!rigidRef.current) return
    const pointerId = e.pointerId ?? e.nativeEvent?.pointerId
    if (controls) controls.enabled = false

    const t = rigidRef.current.translation()
    const r = rigidRef.current.rotation()
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w)

    // Opposite handle local position: right drag → opposite is left (−tip,0,0)
    const oppLocal = new THREE.Vector3(rightHandle ? -tip : tip, 0, 0)
    oppLocal.applyQuaternion(q)
    pivot.current = { x: t.x + oppLocal.x, z: t.z + oppLocal.z }
    pivotY.current = t.y
    isRight.current = rightHandle

    const restType = rigidRef.current.bodyType()
    rigidRef.current.setBodyType(2, true)
    isRotating.current = true

    const onMove = (ev) => {
      if (ev.pointerId !== pointerId || !pivot.current) return
      const rect = gl.domElement.getBoundingClientRect()
      const ndc = {
        x: ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((ev.clientY - rect.top) / rect.height) * 2 + 1,
      }
      raycaster.current.setFromCamera(ndc, camera)
      const hit = new THREE.Vector3()
      if (!raycaster.current.ray.intersectPlane(TABLE_PLANE, hit)) return

      const dx = hit.x - pivot.current.x
      const dz = hit.z - pivot.current.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < 0.01) return

      // Body center stays at tip distance from the pivot in the mouse direction
      const nx = dx / dist, nz = dz / dist
      targetT.current = { x: pivot.current.x + tip * nx, y: pivotY.current, z: pivot.current.z + tip * nz }

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

export function RangeRuler({ number = 2, position = [0, 0, 0], selected = false, onSelect, onPlace }) {
  const raw = useLoader(OBJLoader, `/tools/range-${number}-mesh.obj`)
  const map = useTexture(TEXTURE)
  const [hovered, setHovered] = useState(false)
  const rigidRef = useRef()
  const endMarkerRef = useRef()
  const handleGroupRef = useRef()
  const obj = useMemo(() => textured(raw.clone(), map), [raw, map])
  const tip = RANGE_TIP[number] ?? 1.501

  const onPointerDown = useDragTool(rigidRef)
  const startRotate = useRotateHandle(rigidRef, tip)

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
    applyEmissive(obj, color, intensity)
  }, [obj, hovered, selected])

  function handlePlace(e) {
    e.stopPropagation()
    if (!endMarkerRef.current || !onPlace) return
    const pos = new THREE.Vector3()
    endMarkerRef.current.getWorldPosition(pos)
    onPlace(pos)
  }

  return (
    <>
      {/* Held in the air like a real tool over terrain: kinematic, so it does not fall,
          and a sensor, so models dropped by "Place" fall through it to the table.
          The footprint below is what measures. */}
      <RigidBody ref={rigidRef} type="kinematicPosition" position={position} colliders="hull" sensor>
        <primitive
          object={obj}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
          onPointerOut={() => setHovered(false)}
          onPointerDown={(e) => onPointerDown(e, selected, onSelect)}
        />
        {/* Marker and Html stay inside RigidBody so they follow the body's transform automatically */}
        <group ref={endMarkerRef} position={[tip, 0, 0]} />
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
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontFamily: 'sans-serif',
                  pointerEvents: 'auto',
                  whiteSpace: 'nowrap',
                }}
                onClick={handlePlace}
              >
                Place
              </button>
            </Html>
          </group>
        )}
      </RigidBody>
      <ToolFootprint rigidRef={rigidRef} halfLength={tip} halfWidth={RANGE_HALF_WIDTH} selected={selected} />
      {/* Handles outside RigidBody — purely visual, no physics collider */}
      <group ref={handleGroupRef}>
        <mesh position={[tip, 0.15, 0]} onPointerDown={(e) => startRotate(e, true)}>
          <sphereGeometry args={[0.12, 12, 8]} />
          <meshStandardMaterial color="#f5a623" roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh position={[-tip, 0.15, 0]} onPointerDown={(e) => startRotate(e, false)}>
          <sphereGeometry args={[0.12, 12, 8]} />
          <meshStandardMaterial color="#f5a623" roughness={0.3} metalness={0.5} />
        </mesh>
      </group>
    </>
  )
}
