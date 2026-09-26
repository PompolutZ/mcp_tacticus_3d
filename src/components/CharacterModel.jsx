import { useGLTF } from '@react-three/drei'
import { RigidBody, CylinderCollider, useRapier } from '@react-three/rapier'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Color, Plane, Raycaster, Vector3 } from 'three'

const TEAM_COLORS = { red: '#c0392b', blue: '#2980b9' }
const TABLE_PLANE = new Plane(new Vector3(0, 1, 0), 0)
const DRAG_THRESHOLD = 4
const DAMPING_LOW = 0.2
const DAMPING_HIGH = 10
// Base bottom closer than this to the ground counts as landed
const LANDED_GAP = 0.5
// While dragged, the base hangs this far above the table or terrain below it
const DRAG_HOVER = 0.3
// How fast the dragged model moves to the new hover height, per second
const HOVER_RATE = 25
// Ground casts start this high and go straight down
const CAST_FROM = 100
const NO_ROTATION = { x: 0, y: 0, z: 0, w: 1 }
const DOWN = { x: 0, y: -1, z: 0 }

// Base disk dims from angel.glb mesh0: radius≈0.983, height≈0.118
export const BASE_RADIUS = 0.983
const BASE_HALF_H = 0.059
// Same density for every model, so the mass follows the base size
const BASE_DENSITY = 5

export default function CharacterModel({ url, position = [0, 0, 0], scale = 1, rotation = [0, 0, 0], teamColor = 'red', selected = false, onSelect, bodyRef }) {
  const { scene } = useGLTF(url)
  const { camera, gl, controls } = useThree()
  const { world, rapier } = useRapier()
  const [hovered, setHovered] = useState(false)
  const rigidRef = useRef()
  const moveRef = useRef(null)
  const upRef = useRef(null)
  const raycaster = useRef(new Raycaster())
  const isDragging = useRef(false)
  // True after the model lost its support and may tilt. Picking it up clears it.
  const tipping = useRef(false)
  const mouseNDC = useRef({ x: 0, y: 0 })
  const baseHalfH = BASE_HALF_H * scale
  // Pointer and ground casts hit only fixed bodies (table and terrain), and no sensors
  const groundOnly = rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS
  const baseShape = useMemo(() => new rapier.Cylinder(baseHalfH, BASE_RADIUS * scale), [rapier, baseHalfH, scale])

  // Top of the table or terrain under the whole base at (x, z), or null when nothing is under it.
  // A cast of the base shape, not a ray, so terrain under any part of the base counts.
  function groundY(x, z) {
    const hit = world.castShape({ x, y: CAST_FROM + baseHalfH, z }, NO_ROTATION, DOWN, baseShape, 0, CAST_FROM * 2, true, groundOnly)
    return hit ? CAST_FROM - hit.time_of_impact : null
  }

  // Table or terrain point under the pointer, so the model stays under the cursor on raised terrain
  function pointerPoint() {
    raycaster.current.setFromCamera(mouseNDC.current, camera)
    const { origin, direction } = raycaster.current.ray
    const hit = world.castRay(new rapier.Ray(origin, direction), 1000, true, groundOnly)
    if (hit) return raycaster.current.ray.at(hit.timeOfImpact, new Vector3())
    return raycaster.current.ray.intersectPlane(TABLE_PLANE, new Vector3())
  }

  // True when the base center is over the piece the base rests on, or the base touches nothing yet.
  // Like in TTS, a supported model stays upright even when part of its base hangs over an edge.
  function centerSupported(rb) {
    const base = rb.collider(0)
    const touching = new Set()
    world.contactPairsWith(base, other => {
      world.contactPair(base, other, manifold => { if (manifold.numContacts() > 0) touching.add(other.handle) })
    })
    if (touching.size === 0) return true
    const t = rb.translation()
    const hit = world.castRay(new rapier.Ray({ x: t.x, y: t.y + baseHalfH, z: t.z }, DOWN), CAST_FROM, true, groundOnly)
    return hit !== null && touching.has(hit.collider.handle)
  }

  useFrame((_, dt) => {
    const rb = rigidRef.current
    if (!rb) return
    const t = rb.translation()

    if (isDragging.current) {
      const p = pointerPoint()
      if (!p) return
      // Off the table there is no ground, so keep the current height
      const ground = groundY(p.x, p.z)
      const y = ground === null ? t.y : t.y + (ground + DRAG_HOVER - t.y) * Math.min(1, dt * HOVER_RATE)
      // A sleeping body keeps moving but its mesh is not synced, so keep it awake
      rb.wakeUp()
      rb.setNextKinematicTranslation({ x: p.x, y, z: p.z })
      // Picking the model up stands it upright again if it tipped over
      rb.setNextKinematicRotation(NO_ROTATION)
      return
    }

    const ground = groundY(t.x, t.z)
    const landed = ground !== null && t.y - ground < LANDED_GAP
    rb.setLinearDamping(landed ? DAMPING_HIGH : DAMPING_LOW)

    // The center of mass is past the edge, so let gravity tip the model over
    if (!tipping.current && !centerSupported(rb)) {
      tipping.current = true
      rb.setEnabledRotations(true, false, true, true)
    }
  })

  useEffect(() => {
    const color = new Color(TEAM_COLORS[teamColor] ?? teamColor)
    scene.traverse((obj) => {
      if (!obj.isMesh) return
      obj.castShadow = true
      obj.receiveShadow = true
      if (obj.material?.name === 'defaultMat') {
        obj.material = obj.material.clone()
        obj.material.color = color
      }
    })
  }, [scene, teamColor])

  useEffect(() => {
    const emissiveColor = selected ? '#f5a623' : hovered ? '#ffffff' : '#000000'
    const intensity = selected ? 0.6 : hovered ? 0.4 : 0
    scene.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material.emissive?.set(emissiveColor)
        obj.material.emissiveIntensity = intensity
      }
    })
  }, [scene, hovered, selected])

  function onPointerDown(e) {
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const pointerId = e.pointerId ?? e.nativeEvent?.pointerId
    if (controls) controls.enabled = false
    if (pointerId !== undefined && gl.domElement.hasPointerCapture?.(pointerId)) {
      gl.domElement.releasePointerCapture(pointerId)
    }

    moveRef.current = (ev) => {
      if (ev.pointerId !== pointerId) return
      if (!isDragging.current) {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (!selected || Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        rigidRef.current?.setBodyType(2, true)
        tipping.current = false
        isDragging.current = true
      }
      const rect = gl.domElement.getBoundingClientRect()
      mouseNDC.current = {
        x: ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((ev.clientY - rect.top) / rect.height) * 2 + 1,
      }
    }

    upRef.current = (ev) => {
      if (ev.pointerId !== pointerId) return
      if (isDragging.current) {
        isDragging.current = false
        // Dynamic again, so gravity drops it onto whatever is below
        // Upright again: tilt stays locked until the model loses its support
        rigidRef.current?.lockRotations(true, false)
        rigidRef.current?.setAngvel({ x: 0, y: 0, z: 0 }, false)
        rigidRef.current?.setBodyType(0, true)
      } else {
        onSelect?.()
      }
      if (controls) controls.enabled = true
      window.removeEventListener('pointermove', moveRef.current)
      window.removeEventListener('pointerup', upRef.current)
      moveRef.current = null
      upRef.current = null
    }

    window.addEventListener('pointermove', moveRef.current)
    window.addEventListener('pointerup', upRef.current)
  }

  // Also hand the body to the parent, so tools can read and move it
  function setBody(rb) {
    rigidRef.current = rb
    bodyRef?.(rb)
  }

  // Only the base collides, as in the mod's model bundles, so the center of mass is the base center.
  // Rotation starts locked, so the model stays upright as in TTS. See centerSupported for when it tips.
  return (
    <RigidBody ref={setBody} type="dynamic" position={position} colliders={false} lockRotations linearDamping={DAMPING_LOW} angularDamping={1} ccd>
      <CylinderCollider args={[baseHalfH, BASE_RADIUS * scale]} position={[0, baseHalfH, 0]} friction={1.5} density={BASE_DENSITY} />
      <primitive
        object={scene}
        scale={scale}
        rotation={rotation}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={() => setHovered(false)}
        onPointerDown={onPointerDown}
      />
    </RigidBody>
  )
}
