import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, useRapier } from '@react-three/rapier'
import { Color, MeshStandardMaterial, SRGBColorSpace } from 'three'
import { assetUrl } from '../assets/index.js'
import { castDown, FRICTION } from '../physics.js'
import { startPointerDrag } from '../drag/pointerDrag.js'
import { tablePoint } from '../drag/tablePoint.js'
import {
  BOARD_SCALE,
  BOARD_X,
  BOARD_Y,
  BOARD_YAW,
  ROUND_MARKER_HALF_SIZE,
  ROUND_MARKER_SCALE,
  ROUND_MARKER_TINT,
  ROUND_POINTS,
  COLOR_TINT,
  VP_MARKER_SIZE,
  VP_POINTS,
  snapPoint,
} from './board.js'
import { useSideColor } from '../table/useSideColors.jsx'
import { TEAMS } from '../setup/setup.js'
import { affiliationToken, BOARD_MESH, BOARD_TEXTURE, ROUND_MESH } from './files.js'
import { TOKEN_THICKNESS } from '../tokens/solid.js'
import TokenSolid from '../tokens/TokenSolid.jsx'
import useLiveFollow from '../scene/useLiveFollow.jsx'
import { outlineMode, useOutline } from '../scene/SelectionOutlines.jsx'
import { useDisposeMaterials } from '../scene/useDisposeMaterials.js'
import { useHoverCursor } from '../scene/useHoverCursor.js'
import { SURFACE_GAP } from '../pieces/heights.js'
import { NO_ROTATION } from '../characters/base.js'
import { useRenderCount } from '../debug/renderCount.js'
import { useTableStore } from '../table/TableStoreContext.jsx'

// TTS mirrors X when it imports an OBJ. With the z → -z conversion, this is a 180° turn around Y (see
// Terrain.jsx).
const IMPORT_ROTATION = [0, Math.PI, 0]
// Each VP marker faces its owner: the image top points away from the player's side
const VP_MARKER_YAW = { host: 0, guest: Math.PI }
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
    clone.traverse((child) => {
      if (!child.isMesh) return
      child.material = material
      child.castShadow = true
      child.receiveShadow = true
    })
    return clone
  }, [scene, map])
  useDisposeMaterials(obj)

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
// that lies on another one. pieceKey: the key of the claim, `marker:<host|guest|round>`. The claims on pieces
// (ownership) and the live pose getters (pieceLives) come from the table store (table/tableStore.js). While the other
// player claims the marker (useRemote), it follows their latest numbers (it
// does not lift, so it has no footprint). A cancelled drag (Escape, or a lost tie) puts the marker back to its place
// in the document. children: the marker, with its bottom at y = 0. They can suspend while their
// files load; the drag does not wait for them.
function DraggableMarker({
  pieceKey,
  position,
  points,
  shape,
  halfHeight,
  lift = 0,
  onMove,
  children,
}) {
  const { camera, gl, controls } = useThree()
  const { world, rapier } = useRapier()
  const ownership = useTableStore((s) => s.ownership)
  const pieceLives = useTableStore((s) => s.pieceLives)
  const groupRef = useRef()
  // Live position during a drag. Synced from the position prop when not dragging.
  const poseRef = useRef(position)
  const draggingRef = useRef(false)
  const [hovered, setHovered] = useState(false)

  // The place in the document, for a cancelled drag
  const placeRef = useRef(position)

  useEffect(() => {
    placeRef.current = position
    if (!draggingRef.current) poseRef.current = position
  }, [position])

  useLiveFollow({ pieceKey, poseRef, placeRef })

  useFrame(() => {
    const { x, z } = poseRef.current
    // ONLY_FIXED + EXCLUDE_SENSORS inside castDown, so models and tools are ignored
    const ground = castDown(world, rapier, shape, NO_ROTATION, x, z, halfHeight)
    groupRef.current?.position.set(x, (ground ?? 0) + SURFACE_GAP + lift, z)
  })

  useHoverCursor(hovered, 'grab')
  useOutline(groupRef, outlineMode(false, hovered))

  // Board, terrain or table point under the pointer, the same as CrisisToken.jsx
  function pointerPoint(clientX, clientY) {
    return tablePoint({ camera, canvas: gl.domElement, world, rapier }, clientX, clientY)
  }

  // The press is a drag at once, with no threshold and no click
  function handlePointerDown(e) {
    startPointerDrag(e, {
      key: pieceKey,
      ownership,
      live: pieceLives,
      livePose: () => poseRef.current,
      controls,
      canvas: gl.domElement,
      immediate: true,
      onStart: () => {
        draggingRef.current = true
      },
      onMove: (ev) => {
        const p = pointerPoint(ev.clientX, ev.clientY)
        if (p) poseRef.current = { x: p.x, z: p.z }
      },
      onEnd: () => {
        draggingRef.current = false
        const { x, z } = poseRef.current
        const spot = snapPoint(points, x, z)
        poseRef.current = spot ?? { x, z }
        onMove(poseRef.current.x, poseRef.current.z)
      },
      onCancel: () => {
        draggingRef.current = false
        poseRef.current = placeRef.current
      },
    })
  }

  return (
    <group
      ref={groupRef}
      position={[position.x, 0, position.z]}
      onPointerDown={handlePointerDown}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {children}
    </group>
  )
}

// The face of a VP marker: the player's affiliation token, with the player tint on the edge
function VpMarkerSolid({ team, affiliation }) {
  const map = useTexture(assetUrl(affiliationToken(affiliation)))
  const color = useSideColor(team)
  const edgeColor = useMemo(() => new Color().setRGB(...COLOR_TINT[color], SRGBColorSpace), [color])
  return (
    <TokenSolid
      map={map}
      size={VP_MARKER_SIZE}
      edgeColor={edgeColor}
      rotation={[0, VP_MARKER_YAW[team], 0]}
    />
  )
}

// The round marker mesh, tinted, with its bottom at y = 0
function RoundMarkerMesh() {
  const { scene } = useGLTF(assetUrl(ROUND_MESH))
  const obj = useMemo(() => {
    const color = new Color().setRGB(...ROUND_MARKER_TINT, SRGBColorSpace)
    const material = new MeshStandardMaterial({ color, roughness: 0.5, metalness: 0 })
    const clone = scene.clone()
    clone.traverse((child) => {
      if (!child.isMesh) return
      child.material = material
      child.castShadow = true
    })
    return clone
  }, [scene])
  useDisposeMaterials(obj)
  return (
    <primitive
      object={obj}
      position={[0, ROUND_MARKER_HALF_SIZE, 0]}
      rotation={IMPORT_ROTATION}
      scale={ROUND_MARKER_SCALE}
    />
  )
}

// The scoring board with a VP marker per player and the round marker. Relative to the table, not the mat,
// the same as the dice trays: a map change or a mat turn does not move it. See docs/features/crisis.md,
// "Scoring board".
// markers: { host, guest, round } → { x, z }, see App.jsx. affiliations: { host, guest } → affiliation key.
// onMarkerMove(marker, x, z): a marker was dropped, already moved onto a spot when it was near one.
// The app does not read the score from the board. Players read it, as on a real table.
export default function ScoreBoard({ markers, affiliations, onMarkerMove }) {
  useRenderCount('ScoreBoard')
  const { rapier } = useRapier()
  // The VP marker dropped last. When both players have the same VP, it lies on top of the other one, as
  // in TTS, where the second marker falls onto the first. Both edges show, so both colors can be seen.
  const topVpMarker = useRef('guest')
  const sameSpot =
    Math.hypot(markers.host.x - markers.guest.x, markers.host.z - markers.guest.z) < SAME_SPOT
  const vpShape = useMemo(
    () => new rapier.Cylinder(TOKEN_THICKNESS / 2, VP_MARKER_SIZE / 2),
    [rapier],
  )
  const roundShape = useMemo(
    () => new rapier.Cuboid(ROUND_MARKER_HALF_SIZE, ROUND_MARKER_HALF_SIZE, ROUND_MARKER_HALF_SIZE),
    [rapier],
  )

  return (
    <>
      <Suspense fallback={null}>
        <Board />
      </Suspense>
      {TEAMS.map((team) => (
        <DraggableMarker
          key={team}
          pieceKey={`marker:${team}`}
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
        pieceKey="marker:round"
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
