// The pure parts of the live follow (plan 09, decisions 9 and 14): the numbers of a piece pose, their
// rounding and equality, and the follow step. No three.js and no import.meta.env, so node --test can load it.
//
// Numbers by kind of piece key (plan, "Names"). A model: [x, y, z, qx, qy, qz, qw]. A tool: [x, y, z, yaw,
// right, left]. A crisis token: [x, z, yaw]. A loose token, a pile, a tactic card, a marker: [x, z].
import { roundPiece } from './live.js'

// The time constant of the follow, in seconds (decision 14)
export const FOLLOW_TIME = 0.05

// The part of the way to the latest pose to go in a frame of dt seconds
export function followPart(dt) {
  return 1 - Math.exp(-dt / FOLLOW_TIME)
}

// The same angle a + (the shortest turn to b) * part, so a yaw near ±π does not spin the long way
export function lerpAngle(a, b, part) {
  const diff = Math.atan2(Math.sin(b - a), Math.cos(b - a))
  return a + diff * part
}

// A piece that moves on the table plane only
const FLAT = {
  toNumbers: ({ x, z }) => [x, z],
  fromNumbers: ([x, z]) => ({ x, z }),
}

// kind → how a pose object becomes numbers, and back
const KINDS = {
  character: {
    toNumbers: ({ x, y, z, qx, qy, qz, qw }) => [x, y, z, qx, qy, qz, qw],
    fromNumbers: ([x, y, z, qx, qy, qz, qw]) => ({ x, y, z, qx, qy, qz, qw }),
  },
  tool: {
    toNumbers: ({ x, y, z, yaw, right, left }) => [x, y, z, yaw, right, left],
    fromNumbers: ([x, y, z, yaw, right, left]) => ({ x, y, z, yaw, right, left }),
  },
  token: {
    toNumbers: ({ x, z, yaw }) => [x, z, yaw],
    fromNumbers: ([x, z, yaw]) => ({ x, z, yaw }),
  },
  loose: FLAT,
  pile: FLAT,
  tactic: FLAT,
  marker: FLAT,
}

export const kindOf = (key) => key.slice(0, key.indexOf(':'))

// True when LiveSync handles this kind of key
export const isLiveKind = (key) => Object.hasOwn(KINDS, kindOf(key))

// The numbers of a pose object for key, rounded as in a packet, or null for an unknown kind
export function poseToNumbers(key, pose) {
  const kind = KINDS[kindOf(key)]
  return kind ? roundPiece(key, kind.toNumbers(pose)) : null
}

// The pose object of the numbers of key, or null
export function numbersToPose(key, numbers) {
  const kind = KINDS[kindOf(key)]
  return kind && Array.isArray(numbers) ? kind.fromNumbers(numbers) : null
}

// True when two number arrays are equal. Round both first (poseToNumbers), so "moved" means
// "changed after rounding".
export function sameNumbers(a, b) {
  if (!a || !b || a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

// The rotation numbers of a quaternion to the same hemisphere as the reference, so a slerp takes the short way
// and q and -q are not two poses. Returns [x, y, z, w].
export function sameSideQuat(q, ref) {
  const dot = q[0] * ref[0] + q[1] * ref[1] + q[2] * ref[2] + q[3] * ref[3]
  return dot < 0 ? q.map((v) => -v) : q
}
