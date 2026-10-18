// Unity's built-in meshes as glTF geometry. AssetRipper cannot write them (the mesh is JSON with no geometry),
// so a prefab part that uses one is generated here, in Unity's sizes:
//   cube 1 × 1 × 1; cylinder, capsule: radius 0.5, height 2 along Y; sphere: radius 0.5;
//   plane: 10 × 10 in XZ, facing +Y; quad: 1 × 1 in XY, facing -Z (Unity's quad faces away from +Z).
// The shapes are symmetric in X, so the X mirror of Unity to glTF (unity-prefab.mjs) needs no change; the
// triangles are counter-clockwise outward, as glTF wants. Segment counts are the look of the 3D app, not Unity's.

import * as THREE from 'three'

export const UNITY_PRIMITIVES = ['cube', 'cylinder', 'capsule', 'sphere', 'plane', 'quad']

// Returns { positions, normals, uvs, indices } (typed arrays)
export function unityPrimitive(kind) {
  const geometry = (() => {
    switch (kind) {
      case 'cube':
        return new THREE.BoxGeometry(1, 1, 1)
      case 'cylinder':
        return new THREE.CylinderGeometry(0.5, 0.5, 2, 24)
      case 'capsule':
        // height 2 = straight part 1 + two round ends of radius 0.5
        return new THREE.CapsuleGeometry(0.5, 1, 8, 24)
      case 'sphere':
        return new THREE.SphereGeometry(0.5, 32, 16)
      case 'plane':
        return new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2)
      case 'quad':
        return new THREE.PlaneGeometry(1, 1).rotateY(Math.PI)
      default:
        throw new Error(`Unknown Unity primitive ${kind}`)
    }
  })()
  const index = geometry.getIndex()
  return {
    positions: new Float32Array(geometry.getAttribute('position').array),
    normals: new Float32Array(geometry.getAttribute('normal').array),
    uvs: new Float32Array(geometry.getAttribute('uv').array),
    indices: Uint16Array.from(index.array),
  }
}
