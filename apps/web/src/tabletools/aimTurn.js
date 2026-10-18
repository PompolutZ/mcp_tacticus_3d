import { turnAround } from './toolGeometry.js'

// Range tool aimed at a piece (docs/features/range-movement-tools.md, "Tools"): turn d (yaw) around
// the snapped base center `pivot` that makes the tool direction `localDir` (in the tool frame: the
// direction from the base into the tool) point at point p (table XZ). Turning the whole tool around
// the base keeps it touching the base.
export function aimTurn(yaw, localDir, pivot, p) {
  const c = Math.cos(yaw),
    s = Math.sin(yaw)
  const dirYaw = Math.atan2(-(-localDir.x * s + localDir.z * c), localDir.x * c + localDir.z * s)
  const target = Math.atan2(pivot.z - p.z, p.x - pivot.x)
  return Math.atan2(Math.sin(target - dirYaw), Math.cos(target - dirYaw))
}

// The direction from the snapped base into a range tool, in the tool frame: along the tool, or across it
// on R1 (snap.across: the long side that the base touches). snap: { side, across }.
export function aimDir(snap, rangeOne) {
  return rangeOne ? { x: 0, z: -(snap.across ?? 1) } : { x: snap.side === 'left' ? 1 : -1, z: 0 }
}

// Pose of a snapped range tool (pose { x, z, yaw }) turned around the base center pivot to aim at p, as
// the aim turn does. A locked piece dragged to p makes the tool follow it (docs/features/range-movement-tools.md,
// "Place"). The pose is the same when p is on the base center, where no direction exists.
export function followPose(pose, dir, pivot, p) {
  if (Math.hypot(p.x - pivot.x, p.z - pivot.z) < 0.01) return pose
  return turnAround(pose, pivot, aimTurn(pose.yaw, dir, pivot, p))
}
