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
