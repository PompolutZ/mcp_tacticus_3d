import { useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DoubleSide, Plane, Raycaster, Vector3 } from 'three'
import { castDown } from '../physics.js'
import { crisisMarker, crisisToken } from '../crisis/files.js'
import { assetUrl } from '../assets/index.js'
import { acquireFootprint } from './footprintProjection.js'
import { outlineMode, useOutline } from './SelectionOutlines.jsx'

const TEAM_COLORS = { blue: '#2980b9', red: '#c0392b' }
// A token is a 1" circle, about 0.08" thick (tokens.json size is used for the shape, not the exact
// dims of the current tokens, which are all 1" circles)
const RADIUS = 0.5
const HALF_H = 0.04
// Segments of the face disks and the edge, so the outline looks round at close zoom
const SEGMENTS = 64
// The token images are disks that fill the whole square, with transparent corners and a soft
// (half-transparent) rim. A circle face already cuts off the corners. alphaTest also drops the
// most transparent rim pixels, so no light fringe shows around the edge.
const FACE_ALPHA_TEST = 0.5
// Gap between the ground and the token bottom, so the token never z-fights with the surface
const GAP = 0.02
const DRAG_THRESHOLD = 4
const NO_ROTATION = { x: 0, y: 0, z: 0, w: 1 }
const TABLE_PLANE = new Plane(new Vector3(0, 1, 0), 0)
// Range 3 (6") from the token edge, for the Zone Arc outline
const ARC_RADIUS = RADIUS + 6
const ARC_FILL = '#f5c542'
const ARC_LINE = '#f5c542'
const ARC_OPACITY = 0.22
// Turn handle for a Zone token, on the Arc bisector just past the token edge
const HANDLE_RADIUS = 0.12
const HANDLE_DIST = RADIUS + 0.35
const HANDLE_Y = 0.12
// Control marker: a ring just outside the token edge
const CONTROL_INNER = 0.52
const CONTROL_OUTER = 0.62
// Damage marker: a smaller disk on top of the token
const DAMAGE_RADIUS = 0.3

// Angle (as used by RulerTool/footprintProjection: direction of angle a is (cos a, 0, −sin a))
// from pivot to p, in the table's XZ plane.
function angleTo(pivot, p) {
  return Math.atan2(pivot.z - p.z, p.x - pivot.x)
}

// token: one entry of the tokens array in App.jsx (see buildCardTokens). onMove(x, z) and
// onTurn(yaw): called once, when a drag ends, to commit the new pose to App state.
// onHover(over): called when the pointer moves onto the token (true) and off it (false)
// objectRef: standard ref callback for the token's 3D object, for the ruler tools' pointer raycast.
// centerRef(getter): registers a function that returns the token's live { x, y, z }, for the ruler
// tools. Called with undefined on unmount, the same pattern as bodyRef/objectRef in CharacterModel.
export default function CrisisToken({ token, selected, onSelect, onHover, onMove, onTurn, objectRef, centerRef }) {
  const backKey = token.backKey ?? token.frontKey
  const [frontMap, backMap, damageMap] = useTexture([
    assetUrl(crisisToken(token.frontKey)),
    assetUrl(crisisToken(backKey)),
    assetUrl(crisisMarker('damage')),
  ])
  const [topMap, bottomMap] = token.up === 'front' ? [frontMap, backMap] : [backMap, frontMap]

  const { camera, gl, controls } = useThree()
  const { world, rapier } = useRapier()
  const shape = useMemo(() => new rapier.Cylinder(HALF_H, RADIUS), [rapier])

  const groupRef = useRef()
  // The token disk (faces and edge), without the markers and the turn handle, for the outline
  const diskRef = useRef()
  const [hovered, setHovered] = useState(false)
  // Live pose during a drag, in table XZ and yaw. Synced from the token prop when not dragging.
  const poseRef = useRef({ x: token.x, z: token.z, yaw: token.yaw })
  const draggingRef = useRef(false)
  const raycaster = useRef(new Raycaster())
  const arcSlot = useRef(null)

  useEffect(() => {
    if (!draggingRef.current) poseRef.current = { x: token.x, z: token.z, yaw: token.yaw }
  }, [token.x, token.z, token.yaw])

  // Registers a live getter, not a ref object, because the pose changes on every pointer move of a
  // drag, not only once per frame.
  useEffect(() => {
    centerRef?.(() => ({ x: poseRef.current.x, y: groupRef.current?.position.y ?? 0, z: poseRef.current.z }))
    return () => centerRef?.(undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showArc = selected && token.hasArc
  useEffect(() => {
    if (showArc && !arcSlot.current) arcSlot.current = acquireFootprint()
    if (!showArc && arcSlot.current) {
      arcSlot.current.release()
      arcSlot.current = null
    }
    return () => {
      if (arcSlot.current) {
        arcSlot.current.release()
        arcSlot.current = null
      }
    }
  }, [showArc])

  useFrame(() => {
    const { x, z, yaw } = poseRef.current
    // ONLY_FIXED + EXCLUDE_SENSORS inside castDown, so models and tools are ignored
    const ground = castDown(world, rapier, shape, NO_ROTATION, x, z, HALF_H)
    const y = (ground ?? 0) + GAP + HALF_H
    if (groupRef.current) {
      groupRef.current.position.set(x, y, z)
      groupRef.current.rotation.y = yaw
    }
    if (arcSlot.current) arcSlot.current.setSector(x, z, yaw, yaw + Math.PI / 2, ARC_RADIUS, ARC_FILL, ARC_OPACITY, ARC_LINE)
  })

  // Table or terrain point under the pointer, the same fixed-body-or-table-plane pattern as
  // CharacterModel, so a dragged token stays under the cursor on raised terrain.
  function pointerPoint(clientX, clientY) {
    const rect = gl.domElement.getBoundingClientRect()
    const ndc = { x: ((clientX - rect.left) / rect.width) * 2 - 1, y: -((clientY - rect.top) / rect.height) * 2 + 1 }
    raycaster.current.setFromCamera(ndc, camera)
    const { origin, direction } = raycaster.current.ray
    const filter = rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS
    const hit = world.castRay(new rapier.Ray(origin, direction), 1000, true, filter)
    if (hit) return raycaster.current.ray.at(hit.timeOfImpact, new Vector3())
    return raycaster.current.ray.intersectPlane(TABLE_PLANE, new Vector3())
  }

  function onPointerDown(e) {
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const pointerId = e.pointerId ?? e.nativeEvent?.pointerId
    if (controls) controls.enabled = false
    if (pointerId !== undefined && gl.domElement.hasPointerCapture?.(pointerId)) {
      gl.domElement.releasePointerCapture(pointerId)
    }

    const onPointerMove = (ev) => {
      if (ev.pointerId !== pointerId) return
      if (!draggingRef.current) {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (!selected || !token.canMove || Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        draggingRef.current = true
      }
      const p = pointerPoint(ev.clientX, ev.clientY)
      if (p) {
        poseRef.current.x = p.x
        poseRef.current.z = p.z
      }
    }

    const onPointerUp = (ev) => {
      if (ev.pointerId !== pointerId) return
      if (draggingRef.current) {
        draggingRef.current = false
        onMove?.(poseRef.current.x, poseRef.current.z)
      } else {
        onSelect?.()
      }
      if (controls) controls.enabled = true
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  // Turn handle: drags the token's yaw around its own center. The pivot is the token's current
  // center, read every move so the turn stays correct even if the token is also being repositioned.
  function onHandleDown(e) {
    e.stopPropagation()
    const pointerId = e.pointerId ?? e.nativeEvent?.pointerId
    if (controls) controls.enabled = false
    const pivot = { x: poseRef.current.x, z: poseRef.current.z }
    const start = pointerPoint(e.clientX, e.clientY)
    if (!start) return
    const startAngle = angleTo(pivot, start)
    const startYaw = poseRef.current.yaw

    const onPointerMove = (ev) => {
      if (ev.pointerId !== pointerId) return
      const p = pointerPoint(ev.clientX, ev.clientY)
      if (!p || Math.hypot(p.x - pivot.x, p.z - pivot.z) < 0.01) return
      poseRef.current.yaw = startYaw + (angleTo(pivot, p) - startAngle)
    }

    const onPointerUp = (ev) => {
      if (ev.pointerId !== pointerId) return
      onTurn?.(poseRef.current.yaw)
      if (controls) controls.enabled = true
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  function setGroupRef(obj) {
    groupRef.current = obj
    objectRef?.(obj)
  }

  useOutline(diskRef, outlineMode(selected, hovered))

  // onHover(true) while the pointer is over the token, onHover(false) after. The cleanup also runs
  // on unmount, so a removed token does not stay hovered.
  useEffect(() => {
    if (!hovered) return undefined
    onHover?.(true)
    return () => onHover?.(false)
  }, [hovered])

  const over = e => { e.stopPropagation(); setHovered(true) }
  const out = () => setHovered(false)

  return (
    <group ref={setGroupRef} position={[token.x, 0, token.z]} rotation={[0, token.yaw, 0]}>
      <group ref={diskRef}>
        {/* Top face: the up side. Rotated like the mat and the crisis cards, so local +Y of the image
            (its top) is local -Z, and local +X (its right) stays local +X. See CrisisCard.jsx.
            circleGeometry maps UVs the same way as a plane of size 2 * RADIUS, so the image disk
            fills the circle exactly. */}
        <mesh position={[0, HALF_H, 0]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={onPointerDown} onPointerOver={over} onPointerOut={out}>
          <circleGeometry args={[RADIUS, SEGMENTS]} />
          <meshStandardMaterial map={topMap} alphaTest={FACE_ALPHA_TEST} roughness={1} />
        </mesh>
        {/* Bottom face: the other side */}
        <mesh position={[0, -HALF_H, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[RADIUS, SEGMENTS]} />
          <meshStandardMaterial map={bottomMap} alphaTest={FACE_ALPHA_TEST} roughness={1} />
        </mesh>
        {/* Edge: open-ended, because a cylinder's own top and bottom caps have turned UVs (see the
            note in the design), so the two disks above draw the faces instead. */}
        <mesh onPointerDown={onPointerDown} onPointerOver={over} onPointerOut={out}>
          <cylinderGeometry args={[RADIUS, RADIUS, HALF_H * 2, SEGMENTS, 1, true]} />
          <meshStandardMaterial color="#3a3f4c" roughness={0.6} />
        </mesh>
      </group>
      {token.control && (
        <mesh position={[0, HALF_H + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[CONTROL_INNER, CONTROL_OUTER, 32]} />
          <meshStandardMaterial color={TEAM_COLORS[token.control]} roughness={0.5} side={DoubleSide} />
        </mesh>
      )}
      {token.damage && (
        <mesh position={[0, HALF_H + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[DAMAGE_RADIUS * 2, DAMAGE_RADIUS * 2]} />
          <meshStandardMaterial map={damageMap} transparent roughness={1} />
        </mesh>
      )}
      {selected && token.hasArc && (
        <mesh
          position={[HANDLE_DIST * Math.SQRT1_2, HANDLE_Y, -HANDLE_DIST * Math.SQRT1_2]}
          onPointerDown={onHandleDown}
        >
          <sphereGeometry args={[HANDLE_RADIUS, 16, 12]} />
          <meshStandardMaterial color="#f5a623" roughness={0.3} metalness={0.5} />
        </mesh>
      )}
    </group>
  )
}
