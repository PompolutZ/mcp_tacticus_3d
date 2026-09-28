import { Html, useGLTF, useTexture } from '@react-three/drei'
import { MeshCollider, RigidBody } from '@react-three/rapier'
import { useMemo } from 'react'
import * as THREE from 'three'
import { TERRAIN_PIECES, TTS_MAT_TOP } from '../terrain/maps.js'
import { FRICTION } from '../physics.js'
import { projectFootprints } from './footprintProjection.js'

const DEG = Math.PI / 180
const WHITE = [1, 1, 1]

// TTS (Unity) is left-handed and Three.js is right-handed. Mirroring Z converts one to the other:
// z changes sign, and so do rotations around X and Y. Unity applies Euler angles
// in Z, X, Y order, which is Three.js order 'YXZ'.
function toThreeTransform({ position: [x, y, z], rotation: [rx, ry, rz] }) {
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-rx * DEG, -ry * DEG, rz * DEG, 'YXZ'))
  return { position: [x, y - TTS_MAT_TOP, -z], quaternion }
}

// TTS mirrors X when it imports an OBJ. Combined with the Z mirror above,
// this is a 180° turn around Y, so each mesh gets that turn.
const IMPORT_ROTATION = [0, Math.PI, 0]
// Distance in inches between the top of a piece and its label
const LABEL_GAP = 0.3

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
function ColliderMesh({ url, convex }) {
  const { scene } = useGLTF(url)
  const obj = useMemo(() => scene.clone(), [scene])
  return (
    <MeshCollider type={convex ? 'hull' : 'trimesh'}>
      <primitive object={obj} rotation={IMPORT_ROTATION} visible={false} />
    </MeshCollider>
  )
}

// showLabel: show the piece key and the game Size above the piece
function TerrainPiece({ placement, showLabel }) {
  const piece = TERRAIN_PIECES[placement.piece]
  const { scene: raw } = useGLTF(piece.mesh)
  const map = useTexture(piece.texture)
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
    clone.traverse(child => {
      if (!child.isMesh) return
      child.material = material
      child.castShadow = true
      child.receiveShadow = true
    })
    return clone
  }, [raw, map, placement.tint])
  const { position, quaternion } = useMemo(() => toThreeTransform(placement), [placement])
  const labelPos = useMemo(() => labelPosition(raw, placement.scale), [raw, placement.scale])

  // Fixed collider of the same kind as in the mod, so models stand and tip as they do in TTS.
  // The placement transform is on a group, not on RigidBody: @react-three/rapier 1.5 copies a RigidBody's
  // quaternion prop onto the colliders it builds from the meshes, so every collider would be turned twice.
  // A piece with a collider mesh gets no colliders from the visible mesh. includeInvisible lets
  // MeshCollider read the collider mesh, which is hidden.
  return (
    <group position={position} quaternion={quaternion}>
      <RigidBody
        type="fixed"
        colliders={piece.collider ? false : piece.convex ? 'hull' : 'trimesh'}
        includeInvisible={Boolean(piece.collider)}
        friction={FRICTION}
      >
        <group scale={placement.scale}>
          <primitive object={obj} rotation={IMPORT_ROTATION} />
          {piece.collider && <ColliderMesh url={piece.collider} convex={piece.convex} />}
        </group>
      </RigidBody>
      {showLabel && (
        <Html position={labelPos} center pointerEvents="none" zIndexRange={[100, 0]} className="terrain-label">
          {placement.piece}{placement.size && ` · Size ${placement.size}`}
        </Html>
      )}
    </group>
  )
}

export default function Terrain({ placements, showLabels = false }) {
  return placements.map((placement, i) => <TerrainPiece key={i} placement={placement} showLabel={showLabels} />)
}
