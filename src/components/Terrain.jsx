import { useLoader } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { RigidBody } from '@react-three/rapier'
import { useMemo } from 'react'
import * as THREE from 'three'
import { TERRAIN_PIECES, TTS_MAT_TOP } from '../terrain/maps.js'

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

function TerrainPiece({ placement }) {
  const piece = TERRAIN_PIECES[placement.piece]
  const raw = useLoader(OBJLoader, piece.mesh)
  const map = useTexture(piece.texture)
  const obj = useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace
    // Unity repeats textures by default, and some meshes (the truck) have UVs outside 0..1
    map.wrapS = map.wrapT = THREE.RepeatWrapping
    const color = new THREE.Color().setRGB(...(placement.tint ?? WHITE), THREE.SRGBColorSpace)
    const material = new THREE.MeshStandardMaterial({ map, color, roughness: 0.8, metalness: 0 })
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

  // Fixed collider of the same kind as in the mod, so models stand and tip as they do in TTS
  return (
    <RigidBody type="fixed" colliders={piece.convex ? 'hull' : 'trimesh'} position={position} quaternion={quaternion}>
      <group scale={placement.scale}>
        <primitive object={obj} rotation={IMPORT_ROTATION} />
      </group>
    </RigidBody>
  )
}

export default function Terrain({ placements }) {
  return placements.map((placement, i) => <TerrainPiece key={i} placement={placement} />)
}
