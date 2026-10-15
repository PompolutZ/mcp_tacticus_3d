import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { followPart, lerpAngle, numbersToPose } from '../net/livePose.js'

// A piece MOVED when its live pose is farther than this from its place in the document (inches)
const MOVED = 0.05

// The follow of a piece without a body that the other player claims (docs/features/peer-to-peer.md, "The follow"). Each
// frame it moves poseRef.current a part of the way to the latest live pose of pieceKey (followPart). Until
// the first live pose it does nothing: the piece stays where it is. When the live pose goes (the claim ended),
// poseRef goes back to placeRef at once. Call it before the piece's own useFrame, so the piece draws the new pose.
// remote: the other player claims the piece. getLivePose(key): the latest numbers, or null.
// poseRef: { x, z, yaw? }, the pose the piece draws. placeRef: the place in the document.
// Returns a ref { following, moved }. following: a live pose is followed now. moved: the piece moved away from its
// place since the follow began, so it hangs above the table and shows its footprint (a turn alone does not set
// it). It stays on until the follow ends.
export default function useLiveFollow({ pieceKey, remote, getLivePose, poseRef, placeRef }) {
  const state = useRef({ following: false, moved: false })

  useFrame((_, dt) => {
    const s = state.current
    const numbers = remote && getLivePose ? getLivePose(pieceKey) : null
    const target = numbers && numbersToPose(pieceKey, numbers)
    if (!target) {
      if (s.following) {
        s.following = false
        s.moved = false
        poseRef.current = { ...placeRef.current }
      }
      return
    }
    s.following = true
    const place = placeRef.current
    if (Math.hypot(target.x - place.x, target.z - place.z) > MOVED) s.moved = true
    const part = followPart(dt)
    const pose = poseRef.current
    const next = {
      ...pose,
      x: pose.x + (target.x - pose.x) * part,
      z: pose.z + (target.z - pose.z) * part,
    }
    if (target.yaw !== undefined) next.yaw = lerpAngle(pose.yaw, target.yaw, part)
    poseRef.current = next
  })

  return state
}
