import * as THREE from 'three'
import { DEG } from '../camera.js'
import { TTS_MAT_TOP } from './maps/index.js'

// TTS (Unity) is left-handed and Three.js is right-handed. Mirroring Z converts one to the other:
// z changes sign, and so do rotations around X and Y. Unity applies Euler angles
// in Z, X, Y order, which is Three.js order 'YXZ'.
// placement: { position, rotation } in TTS coords, relative to the mat center. Returns the Three.js
// position (y relative to the mat top) and quaternion.
export function toThreeTransform({ position: [x, y, z], rotation: [rx, ry, rz] }) {
  const quaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-rx * DEG, -ry * DEG, rz * DEG, 'YXZ'),
  )
  return { position: [x, y - TTS_MAT_TOP, -z], quaternion }
}

// The TTS position after a move of (dx, dz) in Three.js coords on the mat. y stays. The Z mirror
// of toThreeTransform turns dz around.
export function movedPosition([x, y, z], dx, dz) {
  return [x + dx, y, z - dz]
}

// The TTS rotation after a Q / E turn. dir 1 is Q: counter-clockwise seen from above, which is a
// positive turn in Three.js and a negative one in TTS (the Z mirror). Result of Y in [0, 360).
export function turnedRotation([rx, ry, rz], dir, step = 15) {
  return [rx, (((ry - dir * step) % 360) + 360) % 360, rz]
}
