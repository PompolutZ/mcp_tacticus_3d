import * as THREE from 'three'
import { fromLocal, toLocal } from './placeLock.js'

// Movement tools are about 0.56" wide (mesh-a spans z = ±0.279)
export const MOVE_HALF_WIDTH = 0.279
// Range tools are 1" wide (mesh spans z = ±0.5)
export const RANGE_HALF_WIDTH = 0.5
// Physics can nudge a resting base a little, so a small gap still counts as contact
export const CONTACT_EPS = 0.01

// A tool has two halves, one on each side of its center: right is local +X, left is local −X.
// On a movement tool the center is the hinge.
export const SIDES = ['right', 'left']
export const OTHER = { right: 'left', left: 'right' }
// How far each half is turned around the center from straight, as a yaw
export const STRAIGHT = { right: 0, left: 0 }
// The angle tool is always bent to a right angle, the same on both sides
export const ANGLE_TURN = { right: Math.PI / 4, left: -Math.PI / 4 }
// A movement tool snapped to the base of an angle tool points at most this far from the middle of the angle
export const ANGLE_LIMIT = Math.PI / 4

// Yaw θ points along world (cos θ, 0, −sin θ). THREE.js Y-rotation by θ maps local +X there.
export function yawQuat(yaw) {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }
}

// Yaw of the direction from a to b (XZ)
export function yawTo(a, b) {
  return Math.atan2(a.z - b.z, b.x - a.x)
}

// The same angle, in −π..π
export function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

const poseEuler = new THREE.Euler(0, 0, 0, 'YXZ')
const poseQuat = new THREE.Quaternion()

// Tool center on the table (XZ) and yaw
export function toolPose(rb) {
  const t = rb.translation()
  const r = rb.rotation()
  poseEuler.setFromQuaternion(poseQuat.set(r.x, r.y, r.z, r.w))
  return { x: t.x, z: t.z, yaw: poseEuler.y }
}

// Tool center and the yaw of each half, pointing out from the center
export function toolShape(pose, turn) {
  return {
    x: pose.x,
    z: pose.z,
    right: pose.yaw + turn.right,
    left: pose.yaw + turn.left + Math.PI,
  }
}

// Point on the center line of one half, dist from the tool center
export function alongHalf(shape, side, dist) {
  const yaw = shape[side]
  return { x: shape.x + dist * Math.cos(yaw), z: shape.z - dist * Math.sin(yaw) }
}

// The half whose end (length from the tool center) is nearer to point p
export function nearerHalf(shape, length, p) {
  const [rightEnd, leftEnd] = SIDES.map((side) => alongHalf(shape, side, length))
  return Math.hypot(rightEnd.x - p.x, rightEnd.z - p.z) <=
    Math.hypot(leftEnd.x - p.x, leftEnd.z - p.z)
    ? 'right'
    : 'left'
}

// Pose turned by yaw d around pivot, as one rigid piece
export function turnAround(pose, pivot, d) {
  const ox = pose.x - pivot.x,
    oz = pose.z - pivot.z
  const c = Math.cos(d),
    s = Math.sin(d)
  return { x: pivot.x + ox * c + oz * s, z: pivot.z - ox * s + oz * c, yaw: pose.yaw + d }
}

// Range 1 (see docs/features/range-movement-tools.md, "Tools"): the tool lies across the line from the base, and its width measures
// range 1. Returns the tool center for this yaw, so that the base (center c) touches the long side
// `across` (±1: local ±Z) at the corner of the end `end` (±1: local ±X).
export function cornerSnapCenter(c, radius, yaw, tip, halfWidth, end, across) {
  const o = fromLocal({ x: 0, z: 0, yaw }, { x: end * tip, z: across * (halfWidth + radius) })
  return { x: c.x - o.x, z: c.z - o.z }
}

// Which corner of the tool the base (center c) is at: the end and the long side nearer to it
export function nearerCorner(pose, c) {
  const l = toLocal(pose, c)
  return { end: l.x >= 0 ? 1 : -1, across: l.z >= 0 ? 1 : -1 }
}

// Tool pose touching the base edge with the end of one half. The tool points from the base
// along yaw. Without a yaw, it points toward the mat center, so it stays on the mat.
// side 'left' (range tools): the left end touches the base, the tool yaw is the pointing direction.
// side 'right' (movement tools): the right (indented) end touches the base, so the tool is turned
// half a turn. The move direction (shape[side] + PI) is the same.
export function snapPose(center, radius, halfLength, yaw, side = 'left') {
  const len = Math.hypot(center.x, center.z)
  const dir = yaw ?? (len > 0.01 ? yawTo(center, { x: 0, z: 0 }) : 0)
  const along = radius + halfLength
  return {
    x: center.x + along * Math.cos(dir),
    z: center.z - along * Math.sin(dir),
    yaw: side === 'right' ? dir + Math.PI : dir,
  }
}

// Angle tool (docs/features/range-movement-tools.md, "Toward / Away"): pose of the tool bent 90° so that both arms touch the base
// (center c). The angle opens along openYaw, from the hinge toward the base. The arm center lines
// are d / √2 from the base center, and the arm is halfWidth wide, so d = √2 (radius + halfWidth).
export function anglePose(c, radius, halfWidth, openYaw) {
  const d = Math.SQRT2 * (radius + halfWidth)
  return {
    x: c.x - d * Math.cos(openYaw),
    z: c.z + d * Math.sin(openYaw),
    yaw: openYaw - Math.PI / 2,
  }
}

// Angle tool pose aimed at point p: the line from the base center to p goes through the hinge.
// Away: the hinge is between the base and p. Toward: the hinge is on the other side of the base.
export function aimPose(c, radius, halfWidth, p, mode) {
  const u = yawTo(c, p)
  return anglePose(c, radius, halfWidth, mode === 'away' ? u + Math.PI : u)
}

// Turn d (yaw) of a movement tool around the base center, cut so that its move direction stays
// within ANGLE_LIMIT of openYaw. moveYaw: the move direction before the turn.
export function limitTurn(moveYaw, openYaw, d) {
  const diff = wrapAngle(moveYaw - openYaw)
  return THREE.MathUtils.clamp(diff + d, -ANGLE_LIMIT, ANGLE_LIMIT) - diff
}

// Range 1: tool pose with the base at the corner of the left end, and the tool on the side of the
// base toward the mat center, so it stays on the mat. The long sides are across the line from the
// base to the mat center.
export function snapPoseOne(center, radius, halfLength, halfWidth) {
  const len = Math.hypot(center.x, center.z)
  const dx = len > 0.01 ? -center.x / len : 1
  const dz = len > 0.01 ? -center.z / len : 0
  // Local +Z points away from the mat center, so the base is on the +Z long side
  const yaw = Math.atan2(-dx, -dz)
  return { ...cornerSnapCenter(center, radius, yaw, halfLength, halfWidth, -1, 1), yaw }
}

// Throw / Push on a straight tool (docs/features/range-movement-tools.md, "Throw / Push"): the base center moves along the middle line,
// from touching the end of half `side` from outside to touching the other end from outside, the same
// as Place. The line follows that half, so it stays straight when the other half is bent.
// Returns { start, dir, distance }: start point (table XZ), unit XZ direction and full distance.
export function throwLine(shape, side, tip, radius) {
  const yaw = shape[side] + Math.PI
  return {
    start: alongHalf(shape, side, tip + radius),
    dir: { x: Math.cos(yaw), z: -Math.sin(yaw) },
    distance: 2 * (tip + radius),
  }
}

// The same character or token. The tool model objects are made again when the pieces change.
export function sameModel(a, b) {
  return a.kind === b.kind && a.id === b.id
}

// The key of a locked model. A character and a token can have the same id.
export function lockKey(model) {
  return `${model.kind}:${model.id}`
}

// Range 1, edge to edge seen from above, between the bases of models a and b. The tool width
// (2 * halfWidth) is range 1.
export function withinRangeOne(a, b, halfWidth) {
  const ca = a.getCenter()
  const cb = b.getCenter()
  return Math.hypot(ca.x - cb.x, ca.z - cb.z) - a.radius - b.radius <= 2 * halfWidth + CONTACT_EPS
}

// The same mark: both null, or the same piece with the same mode
export function sameMark(a, b) {
  return a?.kind === b?.kind && a?.id === b?.id && a?.mode === b?.mode
}
