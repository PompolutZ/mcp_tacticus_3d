import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, useRapier } from '@react-three/rapier'
import { Color, MeshStandardMaterial, Plane, Raycaster, SRGBColorSpace, Vector3 } from 'three'
import { assetUrl } from '../assets/index.js'
import { castDown, FRICTION } from '../physics.js'
import {
  BOARD_SCALE,
  BOARD_X,
  BOARD_Y,
  BOARD_YAW,
  ROUND_MARKER_HALF_SIZE,
  ROUND_MARKER_SCALE,
  ROUND_MARKER_TINT,
  ROUND_POINTS,
  VP_MARKERS,
  VP_MARKER_SIZE,
  VP_POINTS,
  snapPoint,
} from '../scoreboard/board.js'
import { affiliationToken, BOARD_MESH, BOARD_TEXTURE, ROUND_MESH } from '../scoreboard/files.js'
import { TOKEN_THICKNESS } from '../tokens/solid.js'
import TokenSolid from './TokenSolid.jsx'

// TTS mirrors X when it imports an OBJ. With the z → -z conversion, this is a 180° turn around Y (see
// Terrain.jsx).
const IMPORT_ROTATION = [0, Math.PI, 0]
// Gap between the ground and a marker, so the marker never z-fights with the surface (CrisisToken.jsx)
const GAP = 0.02
const NO_ROTATION = { x: 0, y: 0, z: 0, w: 1 }
const TABLE_PLANE = new Plane(new Vector3(0, 1, 0), 0)
// Each VP marker faces its owner: the image top points away from the player's side
const VP_MARKER_YAW = { blue: 0, red: Math.PI }
// Two markers closer than this are on the same spot. Snapped markers have the same position exactly.
const SAME_SPOT = 0.01

// The board. Locked in the mod, so it does not move. The mesh is a shallow tray: the tracks are printed in a
// 0.2" deep recess inside a rim. The mod gives the board a convex collider, which covers the recess, so in
// TTS a marker rests at the height of the rim, above the printed spots. Here the collider has the shape of
// the mesh (trimesh), so a marker rests on its printed spot.
function Board() {
  const { scene } = useGLTF(assetUrl(BOARD_MESH))
  const map = useTexture(assetUrl(BOARD_TEXTURE))
  const obj = useMemo(() => {
    map.colorSpace = SRGBColorSpace
    // The GLB mesh uses glTF UVs (V flipped from OBJ), so the texture must not be flipped (Terrain.jsx)
    map.flipY = false
    const material = new MeshStandardMaterial({ map, roughness: 0.8, metalness: 0 })
    const clone = scene.clone()
    clone.traverse(child => {
      if (!child.isMesh) return
      child.material = material
      child.castShadow = true
      child.receiveShadow = true
    })
    return clone
  }, [scene, map])

  // The transform is on a group, not on RigidBody, for the same reason as in Terrain.jsx
  return (
    <group position={[BOARD_X, BOARD_Y, 0]} rotation={[0, BOARD_YAW, 0]}>
      <RigidBody type="fixed" colliders="trimesh" friction={FRICTION}>
        <group scale={BOARD_SCALE}>
          <primitive object={obj} rotation={IMPORT_ROTATION} />
        </group>
      </RigidBody>
    </group>
  )
}

// A marker that players drag with the left button. It rests on the board or the table under it, the same
// way as a crisis token. When it is released near a spot of `points`, it moves onto that spot (snapPoint).
// position: { x, z } from App. onMove(x, z): called once, when a drag ends. shape: a Rapier shape as wide as
// the marker, for the ground cast. halfHeight: half the shape's height. lift: extra height, for a marker
// that lies on another one. children: the marker, with its bottom at y = 0. They can suspend while their
// files load; the drag does not wait for them.
function DraggableMarker({ position, points, shape, halfHeight, lift = 0, onMove, children }) {
  const { camera, gl, controls } = useThree()
  const { world, rapier } = useRapier()
  const groupRef = useRef()
  // Live position during a drag. Synced from the position prop when not dragging.
  const poseRef = useRef(position)
  const draggingRef = useRef(false)
  const raycaster = useRef(new Raycaster())
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (!draggingRef.current) poseRef.current = position
  }, [position])

  useFrame(() => {
    const { x, z } = poseRef.current
    // ONLY_FIXED + EXCLUDE_SENSORS inside castDown, so models and tools are ignored
    const ground = castDown(world, rapier, shape, NO_ROTATION, x, z, halfHeight)
    groupRef.current?.position.set(x, (ground ?? 0) + GAP + lift, z)
  })

  useEffect(() => {
    if (!hovered) return undefined
    gl.domElement.style.cursor = 'grab'
    return () => { gl.domElement.style.cursor = '' }
  }, [hovered, gl])

  // Board, terrain or table point under the pointer, the same as CrisisToken.jsx
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

  function handlePointerDown(e) {
    // Only the left button moves a piece. A right or middle drag goes to OrbitControls (the camera).
    if (e.button !== 0) return
    e.stopPropagation()
    const pointerId = e.pointerId ?? e.nativeEvent?.pointerId
    if (controls) controls.enabled = false
    if (pointerId !== undefined && gl.domElement.hasPointerCapture?.(pointerId)) {
      gl.domElement.releasePointerCapture(pointerId)
    }
    draggingRef.current = true

    const onPointerMove = (ev) => {
      if (ev.pointerId !== pointerId) return
      const p = pointerPoint(ev.clientX, ev.clientY)
      if (p) poseRef.current = { x: p.x, z: p.z }
    }

    const onPointerUp = (ev) => {
      if (ev.pointerId !== pointerId) return
      draggingRef.current = false
      const { x, z } = poseRef.current
      const spot = snapPoint(points, x, z)
      poseRef.current = spot ?? { x, z }
      onMove(poseRef.current.x, poseRef.current.z)
      if (controls) controls.enabled = true
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  return (
    <group
      ref={groupRef}
      position={[position.x, 0, position.z]}
      onPointerDown={handlePointerDown}
      onPointerOver={e => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      {children}
    </group>
  )
}

// The face of a VP marker: the player's affiliation token, with the player tint on the edge
function VpMarkerSolid({ team, affiliation }) {
  const map = useTexture(assetUrl(affiliationToken(affiliation)))
  const edgeColor = useMemo(() => new Color().setRGB(...VP_MARKERS[team].tint, SRGBColorSpace), [team])
  return <TokenSolid map={map} size={VP_MARKER_SIZE} edgeColor={edgeColor} rotation={[0, VP_MARKER_YAW[team], 0]} />
}

// The round marker mesh, tinted, with its bottom at y = 0
function RoundMarkerMesh() {
  const { scene } = useGLTF(assetUrl(ROUND_MESH))
  const obj = useMemo(() => {
    const color = new Color().setRGB(...ROUND_MARKER_TINT, SRGBColorSpace)
    const material = new MeshStandardMaterial({ color, roughness: 0.5, metalness: 0 })
    const clone = scene.clone()
    clone.traverse(child => {
      if (!child.isMesh) return
      child.material = material
      child.castShadow = true
    })
    return clone
  }, [scene])
  return <primitive object={obj} position={[0, ROUND_MARKER_HALF_SIZE, 0]} rotation={IMPORT_ROTATION} scale={ROUND_MARKER_SCALE} />
}

// The scoring board with a VP marker per player and the round marker. Relative to the table, not the mat,
// the same as the dice trays: a map change or a mat turn does not move it. See docs/feature-crisis.md,
// "Scoring board".
// markers: { blue, red, round } → { x, z }, see App.jsx. affiliations: { blue, red } → affiliation key.
// onMarkerMove(marker, x, z): a marker was dropped, already moved onto a spot when it was near one.
// The app does not read the score from the board. Players read it, as on a real table.
export default function ScoreBoard({ markers, affiliations, onMarkerMove }) {
  const { rapier } = useRapier()
  // The VP marker dropped last. When both players have the same VP, it lies on top of the other one, as
  // in TTS, where the second marker falls onto the first. Both edges show, so both colors can be seen.
  const topVpMarker = useRef('red')
  const sameSpot = Math.hypot(markers.blue.x - markers.red.x, markers.blue.z - markers.red.z) < SAME_SPOT
  const vpShape = useMemo(() => new rapier.Cylinder(TOKEN_THICKNESS / 2, VP_MARKER_SIZE / 2), [rapier])
  const roundShape = useMemo(
    () => new rapier.Cuboid(ROUND_MARKER_HALF_SIZE, ROUND_MARKER_HALF_SIZE, ROUND_MARKER_HALF_SIZE),
    [rapier],
  )

  return (
    <>
      <Suspense fallback={null}>
        <Board />
      </Suspense>
      {['blue', 'red'].map(team => (
        <DraggableMarker
          key={team}
          position={markers[team]}
          points={VP_POINTS}
          shape={vpShape}
          halfHeight={TOKEN_THICKNESS / 2}
          lift={sameSpot && topVpMarker.current === team ? TOKEN_THICKNESS : 0}
          onMove={(x, z) => {
            topVpMarker.current = team
            onMarkerMove(team, x, z)
          }}
        >
          <Suspense fallback={null}>
            <VpMarkerSolid team={team} affiliation={affiliations[team]} />
          </Suspense>
        </DraggableMarker>
      ))}
      <DraggableMarker
        position={markers.round}
        points={ROUND_POINTS}
        shape={roundShape}
        halfHeight={ROUND_MARKER_HALF_SIZE}
        onMove={(x, z) => onMarkerMove('round', x, z)}
      >
        <Suspense fallback={null}>
          <RoundMarkerMesh />
        </Suspense>
      </DraggableMarker>
    </>
  )
}
