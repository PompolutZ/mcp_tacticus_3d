// Rapier colliders of a bundle piece, from its `colliders` entries (see pieces.js and scripts/README.md,
// "Colliders of a bundle"). Plain math, no Three.js or Rapier, so it has a test.
//
// An entry is in GLB space: relative to the piece origin, before IMPORT_ROTATION (a turn of 180° around Y,
// see Terrain.jsx) and the placement scale. Terrain.jsx puts these colliders straight under the RigidBody,
// not in the scaled group: @react-three/rapier 1.5 multiplies the args by the world scale of the collider
// object, and multiplies its position by the scale of the parent a second time (it expects the scale on
// the RigidBody itself). A MeshCollider in the scaled group would be scaled twice too, in args and in
// position. With no scale above them, the lib changes nothing, and this file does the scale: in the size and
// position of a shape, and in the vertices of a collider mesh (transformVertices).

const IMPORT_QUATERNION = [0, 1, 0, 0] // [x, y, z, w]: 180° around Y

// Placement scale as [sx, sy, sz]. A number is a uniform scale.
function scaleVector(scale) {
  return Array.isArray(scale) ? scale : [scale, scale, scale]
}

function multiply([ax, ay, az, aw], [bx, by, bz, bw]) {
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

// The vector v turned by the unit quaternion q
function rotate(q, [vx, vy, vz]) {
  const [x, y, z, w] = q
  // v + 2w(u x v) + 2 u x (u x v), with u = (x, y, z)
  const tx = 2 * (y * vz - z * vy)
  const ty = 2 * (z * vx - x * vz)
  const tz = 2 * (x * vy - y * vx)
  return [
    vx + w * tx + (y * tz - z * ty),
    vy + w * ty + (z * tx - x * tz),
    vz + w * tz + (x * ty - y * tx),
  ]
}

// Position and orientation of an entry under the RigidBody: IMPORT_ROTATION, then the placement scale on the
// position. position [x, y, z] -> [-x, y, -z] -> times the scale.
export function colliderPose(entry, scale) {
  const [sx, sy, sz] = scaleVector(scale)
  const [x, y, z] = entry.position
  const quaternion = multiply(IMPORT_QUATERNION, entry.quaternion ?? [0, 0, 0, 1])
  return { position: [-x * sx, y * sy, -z * sz], quaternion }
}

// Length of each local axis of the entry after the scale (the scale acts on GLB space, so the axis is the
// one in GLB space). A shape cannot follow a non-uniform scale on a turned axis, because a Rapier box or
// cylinder cannot skew. Each size is scaled by the length of its own axis, which is exact when the scale
// is uniform or the shape is not turned, and an approximation otherwise.
function axisScales(entry, scale) {
  const [sx, sy, sz] = scaleVector(scale)
  const q = entry.quaternion ?? [0, 0, 0, 1]
  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ].map((axis) => {
    const [x, y, z] = rotate(q, axis)
    return Math.hypot(x * sx, y * sy, z * sz)
  })
}

// { shape, args, position, quaternion } of a box, cylinder, capsule or sphere entry. shape is the
// @react-three/rapier collider kind: 'cuboid' | 'cylinder' | 'capsule' | 'ball'. args are as Rapier takes
// them, already scaled. Returns null for a mesh entry.
export function primitiveCollider(entry, scale) {
  const [ax, ay, az] = axisScales(entry, scale)
  const pose = colliderPose(entry, scale)
  const radial = (ax + az) / 2
  switch (entry.shape) {
    case 'box': {
      const [hx, hy, hz] = entry.halfExtents
      return { shape: 'cuboid', args: [hx * ax, hy * ay, hz * az], ...pose }
    }
    case 'cylinder':
      return { shape: 'cylinder', args: [entry.halfHeight * ay, entry.radius * radial], ...pose }
    case 'capsule':
      return { shape: 'capsule', args: [entry.halfHeight * ay, entry.radius * radial], ...pose }
    case 'sphere':
      return { shape: 'ball', args: [entry.radius * ((ax + ay + az) / 3)], ...pose }
    default:
      return null
  }
}

// Vertices of a collider mesh under the RigidBody, as a Float32Array [x, y, z, ...]. positions are in the
// space of the collider GLB (node transforms already applied). entry is the `colliders` entry of a bundle
// piece (position, quaternion, scale in GLB space), or undefined for the collider mesh of an OBJ piece.
// Each vertex goes entry scale, entry turn, entry position, IMPORT_ROTATION, placement scale. The result is
// the final shape, so the collider needs no transform and no scale (see the top of this file). Doing the
// scale on the vertices is also exact for a non-uniform placement scale on a turned entry.
export function transformVertices(positions, entry, scale) {
  const [sx, sy, sz] = scaleVector(scale)
  const [px, py, pz] = entry?.position ?? [0, 0, 0]
  const [ex, ey, ez] = entry?.scale ?? [1, 1, 1]
  const q = entry?.quaternion ?? [0, 0, 0, 1]
  const out = new Float32Array(positions.length)
  for (let i = 0; i < positions.length; i += 3) {
    const [x, y, z] = rotate(q, [positions[i] * ex, positions[i + 1] * ey, positions[i + 2] * ez])
    out[i] = -(x + px) * sx
    out[i + 1] = (y + py) * sy
    out[i + 2] = -(z + pz) * sz
  }
  return out
}

// The node of collider mesh n in the one collider GLB of a bundle piece: the n-th child of its scene (the
// script names it `collider-<n>`). The node has no transform, the script baked it into the vertices.
export function colliderNode(scene, n) {
  const node = scene.children[n]
  if (!node) throw new Error(`The collider GLB has no mesh ${n} (${scene.children.length} meshes)`)
  return node
}
