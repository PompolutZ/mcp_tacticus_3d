import { Matrix4, Vector3 } from 'three'

// The move from world point `from` to world point `to`, in the frame of a parent whose world matrix is
// parentWorld. A terrain group sits in the mat group, which turns with matTurns, so a world move must be
// turned back before it is added to group.position or written by movedPosition (placementMove.js).
// Returns { dx, dz } in the parent's coords.
export function localDelta(parentWorld, from, to) {
  const inverse = new Matrix4().copy(parentWorld).invert()
  const a = new Vector3().copy(from).applyMatrix4(inverse)
  const b = new Vector3().copy(to).applyMatrix4(inverse)
  return { dx: b.x - a.x, dz: b.z - a.z }
}
