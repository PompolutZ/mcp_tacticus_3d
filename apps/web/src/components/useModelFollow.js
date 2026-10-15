import { useRef, useState } from 'react'
import { Quaternion, Vector3 } from 'three'
import { followPart } from '../net/livePose.js'

// Scratch values of the follow
const followTarget = { pos: new Vector3(), quat: new Quaternion() }

// The follow of a model that the other player moves (CharacterFigure). It has no effect: the frame of
// CharacterFigure calls followLive.
// getLivePose(key): the latest live numbers, or null. claimKey: the key of the model.
export function useModelFollow({ getLivePose, claimKey }) {
  // The shown pose while the model follows live poses: { pos, quat }, or null. It is kept here, not read
  // from the body, because a kinematic body shows the new pose only after the next physics step.
  const follow = useRef(null)
  // The model follows live poses now: mounts the footprint of the base
  const [following, setFollowing] = useState(false)

  // Goes the 1 − e^(−dt / 0.05) part of the way to the latest live pose (decision 14). Without a live pose
  // the model stays where it is.
  function followLive(rb, dt) {
    const numbers = getLivePose?.(claimKey)
    if (!numbers) {
      if (follow.current) {
        follow.current = null
        setFollowing(false)
      }
      return
    }
    if (!follow.current) {
      const t = rb.translation()
      const r = rb.rotation()
      follow.current = { pos: new Vector3(t.x, t.y, t.z), quat: new Quaternion(r.x, r.y, r.z, r.w) }
      setFollowing(true)
    }
    const part = followPart(dt)
    const { pos, quat } = follow.current
    pos.lerp(followTarget.pos.set(numbers[0], numbers[1], numbers[2]), part)
    quat.slerp(followTarget.quat.set(numbers[3], numbers[4], numbers[5], numbers[6]), part)
    // A sleeping body moves but its mesh is not synced, so keep it awake (as in the drag)
    rb.wakeUp()
    rb.setNextKinematicTranslation(pos)
    rb.setNextKinematicRotation(quat)
  }

  return { follow, following, setFollowing, followLive }
}
