import { Html, useGLTF, useTexture } from '@react-three/drei'
import {
  BallCollider,
  CapsuleCollider,
  CuboidCollider,
  CylinderCollider,
  MeshCollider,
  RigidBody,
} from '@react-three/rapier'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { assetUrl } from '../assets/index.js'
import { primitiveCollider } from '../terrain/bundleColliders.js'
import { bundleCollider, pieceCollider, pieceMesh, pieceTexture } from '../terrain/files.js'
import { TTS_MAT_TOP } from '../terrain/maps.js'
import { terrainLabel } from '../terrain/label.js'
import { TERRAIN_PIECES } from '../terrain/pieces.js'
import { FRICTION } from '../physics.js'
import { projectFootprints } from './footprintProjection.js'
import { outlineMode, useOutline } from './SelectionOutlines.jsx'
import { useHoverCursor } from './useHoverCursor.js'

const DEG = Math.PI / 180
const WHITE = [1, 1, 1]
// A press that moves the pointer more than this (px) before the release is a camera drag, not a click.
// The same limit as R3F uses for a click on the empty table (onPointerMissed in App.jsx).
const CLICK_SLOP = 2

// TTS (Unity) is left-handed and Three.js is right-handed. Mirroring Z converts one to the other:
// z changes sign, and so do rotations around X and Y. Unity applies Euler angles
// in Z, X, Y order, which is Three.js order 'YXZ'.
function toThreeTransform({ position: [x, y, z], rotation: [rx, ry, rz] }) {
  const quaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-rx * DEG, -ry * DEG, rz * DEG, 'YXZ'),
  )
  return { position: [x, y - TTS_MAT_TOP, -z], quaternion }
}

// TTS mirrors X when it imports an OBJ. Combined with the Z mirror above,
// this is a 180° turn around Y, so each mesh gets that turn.
const IMPORT_ROTATION = [0, Math.PI, 0]
// Distance in inches between the top of a piece and its label
const LABEL_GAP = 0.3
// The label must not take the pointer from the piece. Without an <Html transform>, drei ignores its
// pointerEvents prop, so the style sets it (see TokenFace.jsx).
const NO_POINTER = { pointerEvents: 'none' }

// Label position in the placement group: above the top center of the mesh's bounding box.
// raw is the loaded scene, which is never mounted, so its box is in mesh space.
// IMPORT_ROTATION changes the sign of x and z, and then the placement scale applies.
function labelPosition(raw, scale) {
  const [sx, sy, sz] = Array.isArray(scale) ? scale : [scale, scale, scale]
  const box = new THREE.Box3().setFromObject(raw)
  const center = box.getCenter(new THREE.Vector3())
  return [-center.x * sx, box.max.y * sy + LABEL_GAP, -center.z * sz]
}

// The mod's collider mesh of a piece, when it is not the visible mesh. It is converted from OBJ
// in the same way as the visible mesh, so it gets the same turn. It is not drawn.
// entry: the `colliders` entry of a bundle piece, which places the mesh in the prefab (position,
// quaternion, scale in GLB space, before the turn). The mesh of an OBJ piece has none. Checked only with
// the identity entries of the maps so far.
function ColliderMesh({ url, convex, entry }) {
  const { scene } = useGLTF(url)
  const obj = useMemo(() => scene.clone(), [scene])
  return (
    <group rotation={IMPORT_ROTATION}>
      <group position={entry?.position} quaternion={entry?.quaternion} scale={entry?.scale}>
        <MeshCollider type={convex ? 'hull' : 'trimesh'}>
          <primitive object={obj} visible={false} />
        </MeshCollider>
      </group>
    </group>
  )
}

const PRIMITIVE_COLLIDERS = {
  cuboid: CuboidCollider,
  cylinder: CylinderCollider,
  capsule: CapsuleCollider,
  ball: BallCollider,
}

// The box, cylinder, capsule and sphere colliders of a bundle piece. They sit directly under the
// RigidBody, with the placement scale already in their size and position, see terrain/bundleColliders.js
// for why they are not in the scaled group.
function PrimitiveColliders({ colliders, scale }) {
  return colliders.map((entry, i) => {
    const c = primitiveCollider(entry, scale)
    if (!c) return null
    const Collider = PRIMITIVE_COLLIDERS[c.shape]
    return (
      <Collider
        key={i}
        args={c.args}
        position={c.position}
        quaternion={c.quaternion}
        friction={FRICTION}
      />
    )
  })
}

// The files of a terrain piece, as TerrainPiece loads them: mesh, texture (null for a bundle piece, whose
// GLB has its materials), collider mesh of an OBJ piece or null, and the collider meshes of a bundle piece.
// Preload.jsx loads the same before a table shows (docs/features/rooms.md, "Loading").
export function pieceUrls(key) {
  const piece = TERRAIN_PIECES[key]
  return {
    mesh: assetUrl(pieceMesh(key)),
    texture: piece.bundle ? null : assetUrl(pieceTexture(key)),
    collider: piece.collider ? assetUrl(pieceCollider(key)) : null,
    colliders: bundleColliderMeshes(key).map(({ n }) => assetUrl(bundleCollider(key, n))),
  }
}

// The `mesh` entries of a bundle piece: [{ n, entry }], n is the number of the collider GLB
function bundleColliderMeshes(key) {
  return (TERRAIN_PIECES[key].colliders ?? [])
    .filter((entry) => entry.shape === 'mesh')
    .map((entry) => ({ n: entry.mesh, entry }))
}

// placement: a terrain piece on the mat, see mapTerrain in rooms/table.js.
// showLabel: show the label (name, game Size, lock state) above the piece
// selected: the piece is selected. onSelect(): a click on the piece. onHover(over): the pointer
// moved onto (true) or off (false) the piece, for the Delete key.
// objectRef(obj): the visible mesh of the piece, or null on unmount. Scene finds the piece under the
// pointer with it, for the L key.
function TerrainPiece(props) {
  return TERRAIN_PIECES[props.placement.piece].bundle ? (
    <BundlePiece {...props} />
  ) : (
    <ObjPiece {...props} />
  )
}

// An OBJ piece: one mesh, one texture, one material.
function ObjPiece(props) {
  const { placement } = props
  const piece = TERRAIN_PIECES[placement.piece]
  const urls = pieceUrls(placement.piece)
  const { scene: raw } = useGLTF(urls.mesh)
  const map = useTexture(urls.texture)
  const obj = useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace
    // The GLB meshes use glTF UVs (V flipped from OBJ), so the texture must not be flipped
    map.flipY = false
    // Unity repeats textures by default, and some meshes (the truck) have UVs outside 0..1
    map.wrapS = map.wrapT = THREE.RepeatWrapping
    const color = new THREE.Color().setRGB(...(placement.tint ?? WHITE), THREE.SRGBColorSpace)
    const material = new THREE.MeshStandardMaterial({ map, color, roughness: 0.8, metalness: 0 })
    material.onBeforeCompile = projectFootprints
    const clone = raw.clone()
    clone.traverse((child) => {
      if (!child.isMesh) return
      child.material = material
      child.castShadow = true
      child.receiveShadow = true
    })
    return clone
  }, [raw, map, placement.tint])
  return (
    <PieceBody
      {...props}
      raw={raw}
      obj={obj}
      autoColliders={piece.collider ? false : piece.convex ? 'hull' : 'trimesh'}
      meshColliders={urls.collider && <ColliderMesh url={urls.collider} convex={piece.convex} />}
    />
  )
}

// A bundle piece: the GLB has its own materials, so the piece keeps them (a copy for each placement)
// and gets the tint on top. The colliders are the `colliders` entries, not the visible mesh.
function BundlePiece(props) {
  const { placement } = props
  const piece = TERRAIN_PIECES[placement.piece]
  const urls = pieceUrls(placement.piece)
  const { scene: raw } = useGLTF(urls.mesh)
  const obj = useMemo(() => {
    // TTS multiplies the model colors by the tint. The color is sRGB, as for an OBJ piece.
    const tint = new THREE.Color().setRGB(...(placement.tint ?? WHITE), THREE.SRGBColorSpace)
    const clone = raw.clone()
    clone.traverse((child) => {
      if (!child.isMesh) return
      const copy = (material) => {
        const m = material.clone()
        m.color?.multiply(tint)
        m.onBeforeCompile = projectFootprints
        return m
      }
      child.material = Array.isArray(child.material)
        ? child.material.map(copy)
        : copy(child.material)
      child.castShadow = true
      child.receiveShadow = true
    })
    return clone
  }, [raw, placement.tint])
  useEffect(
    () => () =>
      obj.traverse((child) => {
        if (child.isMesh) [child.material].flat().forEach((m) => m.dispose())
      }),
    [obj],
  )
  const meshes = bundleColliderMeshes(placement.piece)
  return (
    <PieceBody
      {...props}
      raw={raw}
      obj={obj}
      autoColliders={false}
      meshColliders={meshes.map(({ n, entry }, i) => (
        <ColliderMesh key={n} url={urls.colliders[i]} convex={entry.convex} entry={entry} />
      ))}
      shapeColliders={<PrimitiveColliders colliders={piece.colliders} scale={placement.scale} />}
    />
  )
}

// The part that both kinds share: transform, RigidBody, pointer handling, outline and label.
// obj: the visible mesh. raw: the loaded GLB scene, for the label position.
// autoColliders: the RigidBody colliders option. meshColliders: collider meshes, in the scaled group.
// shapeColliders: primitive colliders with the scale already in them, directly under the RigidBody.
function PieceBody({
  placement,
  showLabel,
  selected,
  onSelect,
  onHover,
  objectRef,
  raw,
  obj,
  autoColliders,
  meshColliders,
  shapeColliders,
}) {
  const piece = TERRAIN_PIECES[placement.piece]
  const { locked } = placement
  const meshRef = useRef(null)
  const [hovered, setHovered] = useState(false)
  const { position, quaternion } = useMemo(() => toThreeTransform(placement), [placement])
  const labelPos = useMemo(() => labelPosition(raw, placement.scale), [raw, placement.scale])

  useOutline(meshRef, outlineMode(selected, hovered))

  // A locked piece gets no pointer events (see the primitive below), so no pointerout ends its hover
  useEffect(() => {
    if (locked) setHovered(false)
  }, [locked])

  // A click selects the piece. It cannot be dragged.
  useHoverCursor(hovered, 'pointer')

  // onHover(true) while the pointer is over the piece, onHover(false) after. The cleanup also runs on
  // unmount, so a deleted piece does not stay hovered.
  useEffect(() => {
    if (!hovered) return undefined
    onHover?.(true)
    return () => onHover?.(false)
  }, [hovered])

  function setMesh(obj) {
    meshRef.current = obj
    objectRef?.(obj)
  }

  // pointerdown stops here, so a piece behind this one does not start its own select or drag.
  // The camera still turns on a drag, because OrbitControls does not get R3F events.
  function handlePointerDown(e) {
    e.stopPropagation()
  }

  // A camera drag that starts on the piece is not a click
  function handleClick(e) {
    if (e.delta > CLICK_SLOP) return
    e.stopPropagation()
    onSelect?.()
  }

  // Fixed collider of the same kind as in the mod, so models stand and tip as they do in TTS.
  // The placement transform is on a group, not on RigidBody: @react-three/rapier 1.5 copies a RigidBody's
  // quaternion prop onto the colliders it builds from the meshes, so every collider would be turned twice.
  // A piece with a collider mesh, and a bundle piece, get no colliders from the visible mesh.
  // includeInvisible lets MeshCollider read the collider mesh, which is hidden.
  // A bundle piece has its colliders from the `colliders` entries: the meshes in the scaled group (with
  // IMPORT_ROTATION), the shapes under the RigidBody, see terrain/bundleColliders.js.
  // A locked piece has no pointer handlers, so R3F does not see it: a click on it is a click on the
  // empty table, and a piece behind it gets the pointer events. Only an unlocked piece can be hovered,
  // selected and deleted.
  return (
    <group position={position} quaternion={quaternion}>
      <RigidBody
        type="fixed"
        colliders={autoColliders}
        includeInvisible={autoColliders === false}
        friction={FRICTION}
      >
        <group scale={placement.scale}>
          <primitive
            ref={setMesh}
            object={obj}
            rotation={IMPORT_ROTATION}
            onPointerOver={
              locked
                ? undefined
                : (e) => {
                    e.stopPropagation()
                    setHovered(true)
                  }
            }
            onPointerOut={locked ? undefined : () => setHovered(false)}
            onPointerDown={locked ? undefined : handlePointerDown}
            onClick={locked ? undefined : handleClick}
          />
          {meshColliders}
        </group>
        {shapeColliders}
      </RigidBody>
      {showLabel && (
        <Html
          position={labelPos}
          center
          style={NO_POINTER}
          zIndexRange={[100, 0]}
          className="terrain-label"
        >
          {terrainLabel(piece.name, placement.size, locked)}
        </Html>
      )}
    </group>
  )
}

// placements: the terrain pieces on the mat, [{ id, locked, ...placement }] (see mapTerrain in rooms/table.js).
// hoverLabelId: id of the piece under the pointer while labels are off (Scene finds it with a ray, so
// a locked piece gets it too), or null. That piece shows its label.
// selectedId: id of the selected piece, or null. onSelect(id), onHover(id, over), objectRef(id, obj):
// see TerrainPiece.
export default function Terrain({
  placements,
  showLabels = false,
  hoverLabelId = null,
  selectedId = null,
  onSelect,
  onHover,
  objectRef,
}) {
  return placements.map((placement) => (
    <TerrainPiece
      key={placement.id}
      placement={placement}
      showLabel={showLabels || hoverLabelId === placement.id}
      selected={selectedId === placement.id}
      onSelect={() => onSelect?.(placement.id)}
      onHover={(over) => onHover?.(placement.id, over)}
      objectRef={(obj) => objectRef?.(placement.id, obj)}
    />
  ))
}
