import { useGLTF } from '@react-three/drei'
import { RigidBody, CylinderCollider, useRapier } from '@react-three/rapier'
import { useEffect, useRef, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Color, Plane, Raycaster, Vector3 } from 'three'
import { FRICTION, castDown } from '../physics.js'

const TEAM_COLORS = { red: '#c0392b', blue: '#2980b9' }
const TABLE_PLANE = new Plane(new Vector3(0, 1, 0), 0)
const DRAG_THRESHOLD = 4
// While dragged, the base hangs this far above the table or terrain below it
const DRAG_HOVER = 0.3
// How fast the dragged model moves to the new hover height, per second
const HOVER_RATE = 25
const NO_ROTATION = { x: 0, y: 0, z: 0, w: 1 }
const ZERO = { x: 0, y: 0, z: 0 }
// A model that stays within SETTLE_MOVE inches and SETTLE_TURN of one pose for SETTLE_TIME seconds is put
// to sleep, as PhysX does in TTS. Without it, a model resting on a curved hull (made of many small faces)
// shakes and creeps down it, and Rapier never puts it to sleep because of the shaking.
const SETTLE_TIME = 0.5
const SETTLE_MOVE = 0.05
const SETTLE_TURN = 2 * Math.PI / 180

// Base disk dims from angel.glb mesh0: radius≈0.983, height≈0.118
export const BASE_RADIUS = 0.983
const BASE_HALF_H = 0.059
// Same density for every model, so the mass follows the base size
const BASE_DENSITY = 5
// TTS drag of every object
const LINEAR_DAMPING = 0.1
// TTS angular drag is 0.1, but the TTS base is a 32-sided prism. It loses energy each time it rolls over
// an edge of the prism. This base is a round cylinder, which rolls on its rim without losing energy,
// so a model that leans on terrain rocks for a long time. The higher damping stops that.
// A 32-sided hull like the TTS base is not used because in Rapier it sinks into terrain hulls.
const ANGULAR_DAMPING = 5

// Same heading, but standing upright: keeps only the turn around the vertical axis
export function upright({ y, w }) {
  const len = Math.hypot(y, w)
  return len < 1e-6 ? NO_ROTATION : { x: 0, y: y / len, z: 0, w: w / len }
}

// Top of the table or terrain under the whole base at (x, z), or null when nothing is under it.
// A cast of the base shape, not a ray, so terrain under any part of the base counts.
// The body origin is the base bottom, so this is also the body Y that puts the base on the ground.
export function baseGroundY(world, rapier, x, z, scale = 1) {
  const halfH = BASE_HALF_H * scale
  return castDown(world, rapier, new rapier.Cylinder(halfH, BASE_RADIUS * scale), NO_ROTATION, x, z, halfH)
}

// Angle between two rotations, in radians
function turnBetween(a, b) {
  const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)
  return 2 * Math.acos(Math.min(1, dot))
}

// bodyRef, objectRef: get the Rapier body and the 3D object of the model (figure and base)
export default function CharacterModel({ url, position = [0, 0, 0], scale = 1, rotation = [0, 0, 0], teamColor = 'red', selected = false, onSelect, bodyRef, objectRef }) {
  const { scene } = useGLTF(url)
  const { camera, gl, controls } = useThree()
  const { world, rapier } = useRapier()
  const [hovered, setHovered] = useState(false)
  const rigidRef = useRef()
  const moveRef = useRef(null)
  const upRef = useRef(null)
  const raycaster = useRef(new Raycaster())
  const isDragging = useRef(false)
  // Pose the model has stayed close to, and for how long: { t, r, time }. See SETTLE_TIME.
  const rest = useRef(null)
  const mouseNDC = useRef({ x: 0, y: 0 })
  const baseHalfH = BASE_HALF_H * scale
  // Pointer and ground casts hit only fixed bodies (table and terrain), and no sensors
  const groundOnly = rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS

  function groundY(x, z) {
    return baseGroundY(world, rapier, x, z, scale)
  }

  // Table or terrain point under the pointer, so the model stays under the cursor on raised terrain
  function pointerPoint() {
    raycaster.current.setFromCamera(mouseNDC.current, camera)
    const { origin, direction } = raycaster.current.ray
    const hit = world.castRay(new rapier.Ray(origin, direction), 1000, true, groundOnly)
    if (hit) return raycaster.current.ray.at(hit.timeOfImpact, new Vector3())
    return raycaster.current.ray.intersectPlane(TABLE_PLANE, new Vector3())
  }

  // Puts the body to sleep once it has stayed close to one pose for SETTLE_TIME
  function settle(rb, dt) {
    if (rb.isSleeping()) {
      rest.current = null
      return
    }
    const t = rb.translation()
    const r = rb.rotation()
    const ref = rest.current
    if (ref && Math.hypot(t.x - ref.t.x, t.y - ref.t.y, t.z - ref.t.z) < SETTLE_MOVE && turnBetween(r, ref.r) < SETTLE_TURN) {
      ref.time += dt
      if (ref.time >= SETTLE_TIME) {
        rb.sleep()
        rest.current = null
      }
      return
    }
    rest.current = { t, r, time: 0 }
  }

  useFrame((_, dt) => {
    const rb = rigidRef.current
    if (!rb) return
    if (!isDragging.current) {
      settle(rb, dt)
      return
    }
    rest.current = null
    const p = pointerPoint()
    if (!p) return
    const t = rb.translation()
    // Off the table there is no ground, so keep the current height.
    // Never below the ground: a base released inside terrain can be pushed out through the bottom of it.
    const ground = groundY(p.x, p.z)
    const y = ground === null ? t.y : Math.max(ground, t.y + (ground + DRAG_HOVER - t.y) * Math.min(1, dt * HOVER_RATE))
    // A sleeping body keeps moving but its mesh is not synced, so keep it awake
    rb.wakeUp()
    rb.setNextKinematicTranslation({ x: p.x, y, z: p.z })
    // Picking the model up stands it upright again if it tipped over, as a TTS figurine does
    rb.setNextKinematicRotation(upright(rb.rotation()))
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
        // Dynamic again, so gravity drops it onto whatever is below.
        // No velocity from the drag, so it drops straight down and is not thrown.
        rigidRef.current?.setBodyType(0, true)
        rigidRef.current?.setLinvel(ZERO, true)
        rigidRef.current?.setAngvel(ZERO, true)
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
  // Rotation is free, as in TTS: the model stays upright while its center of mass is over the ground
  // and tips over when it is past an edge.
  return (
    <RigidBody ref={setBody} type="dynamic" position={position} colliders={false} linearDamping={LINEAR_DAMPING} angularDamping={ANGULAR_DAMPING} ccd>
      <CylinderCollider args={[baseHalfH, BASE_RADIUS * scale]} position={[0, baseHalfH, 0]} friction={FRICTION} density={BASE_DENSITY} />
      <primitive
        ref={objectRef}
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
