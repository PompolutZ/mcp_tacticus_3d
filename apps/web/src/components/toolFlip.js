// Flip a movement tool: the halves swap places. The right half (the indented end) takes the world
// direction of the old left half, and the left half the old right half's. The outline stays in the
// same world place. See toolShape in toolGeometry.js: right = yaw + turn.right, left = yaw + turn.left + PI.
export function flipTool(pose, turn) {
  return {
    pose: { ...pose, yaw: pose.yaw + Math.PI },
    turn: { right: turn.left, left: turn.right },
  }
}
