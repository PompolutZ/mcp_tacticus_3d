// The size and place of the selection ring of a piece (SelectionOutlines.jsx). Plain module, only math.
import { Vector3 } from 'three'

// The ring is larger than the piece by this much on each side, in inches
export const RING_PAD = 0.15

const CORNERS = [0, 1]

// The footprint of the meshes of a piece, as the ring needs it. The box is measured in the frame of the piece,
// turned by its yaw, so a turned card or tool gets a ring that is turned with it, not the larger box in world axes.
// object: the piece. meshes: its meshes. Returns:
//   x, z: the box center, in the turned frame, from the piece origin
//   y: the lowest point in the world
//   halfX, halfZ: the half size of the ring (box plus RING_PAD)
// or null when the meshes have no size.
// Reads the world matrices of the piece now, so call it when the piece is on the table.
export function ringFootprint(object, meshes) {
  object.updateWorldMatrix(true, true)
  const origin = object.getWorldPosition(new Vector3())
  const yaw = yawOf(object)
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const point = new Vector3()
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  let minY = Infinity
  for (const mesh of meshes) {
    const geometry = mesh.geometry
    if (!geometry) continue
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    const { min, max } = geometry.boundingBox
    for (const i of CORNERS)
      for (const j of CORNERS)
        for (const k of CORNERS) {
          point
            .set(i ? max.x : min.x, j ? max.y : min.y, k ? max.z : min.z)
            .applyMatrix4(mesh.matrixWorld)
          const dx = point.x - origin.x
          const dz = point.z - origin.z
          // The offset turned by -yaw
          const x = dx * cos - dz * sin
          const z = dx * sin + dz * cos
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          minZ = Math.min(minZ, z)
          maxZ = Math.max(maxZ, z)
          minY = Math.min(minY, point.y)
        }
  }
  if (!Number.isFinite(minX + maxX + minZ + maxZ + minY)) return null
  return {
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
    y: minY,
    halfX: (maxX - minX) / 2 + RING_PAD,
    halfZ: (maxZ - minZ) / 2 + RING_PAD,
  }
}

// The turn of the piece around the vertical axis, in radians
export function yawOf(object) {
  const e = object.matrixWorld.elements
  // The direction of the local +x axis on the table plane. For R_y(yaw): x axis = (cos, 0, -sin).
  return Math.atan2(-e[2], e[0])
}
