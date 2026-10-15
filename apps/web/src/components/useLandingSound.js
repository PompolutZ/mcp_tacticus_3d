import { useRef } from 'react'
import { useAfterPhysicsStep } from '@react-three/rapier'
import { WORLD_GRAVITY } from '../physics.js'
import {
  MODEL_BUMP_MAX,
  MODEL_BUMP_MIN,
  REMOTE_MODEL_BUMP_MAX,
  REMOTE_MODEL_BUMP_MIN,
  REMOTE_MODEL_MAX_SPEED,
  REMOTE_MODEL_MERGE_MS,
  REMOTE_MODEL_REST_MS,
  createBumpFinder,
  createPoseBumpFinder,
} from '../bumps.js'
import { playSound } from '../sound.js'

// A model lands on terrain, not on the table top, when what is under its base is higher than this
// (inches). The table top is y = 0 (docs/features/sounds.md).
const TERRAIN_MIN_TOP = 0.05
// The cast for the support of a landed model starts this far (inches) above its base bottom
const SUPPORT_LIFT = 0.1

// The landing sounds of a model: its own landings and the other player's. Has the effect of
// useAfterPhysicsStep.
// groundBelow(x, z, from): baseGroundY of the base (CharacterModel.jsx). rigidRef, remoteRef: refs of
// CharacterFigure. Returns the refs the remote mode effect resets, and listenLanding for the frame.
export function useLandingSound({
  groundBelow,
  rigidRef,
  remoteRef,
  claimKey,
  otherDragging,
  getLivePose,
  getLiveTime,
}) {
  // The bump finder of the landing sound: of the body (own model) or of the live poses (remote
  // model), and the last live position. See landed.
  const bump = useRef(null)
  const remoteBump = useRef(null)
  const livePlace = useRef(null)

  // The sound of a landing at body position (x, y, z): the terrain sound when the base rests on
  // terrain, the mat sound on the table top. strength: 0 to 1, from the bump finder.
  function landed(x, y, z, strength) {
    const top = groundBelow(x, z, y + SUPPORT_LIFT)
    const group = top !== null && top > TERRAIN_MIN_TOP ? 'modelTerrain' : 'modelMat'
    playSound(group, { volume: strength, key: claimKey })
  }

  // The landing of the other player's model, from its live poses. The finder also gets the poses
  // of a drag and a lift, and it ignores them, because no free fall comes before them.
  // A bump that starts in a drag is dropped.
  function listenLanding() {
    const finder = (remoteBump.current ??= createPoseBumpFinder({
      gravity: -WORLD_GRAVITY,
      min: REMOTE_MODEL_BUMP_MIN,
      max: REMOTE_MODEL_BUMP_MAX,
      maxSpeed: REMOTE_MODEL_MAX_SPEED,
      gapMs: Infinity,
      mergeMs: REMOTE_MODEL_MERGE_MS,
      restMs: REMOTE_MODEL_REST_MS,
      vertical: true,
      afterFall: true,
    }))
    const n = getLivePose?.(claimKey)
    const time = getLiveTime?.(claimKey)
    let strength = 0
    if (n && time != null) {
      livePlace.current = { x: n[0], y: n[1], z: n[2] }
      strength = finder.feed(livePlace.current, time)
    }
    strength = Math.max(strength, finder.poll(performance.now()))
    if (otherDragging) finder.discard()
    else if (strength > 0 && livePlace.current) {
      const { x, y, z } = livePlace.current
      landed(x, y, z, strength)
    }
  }

  // A sound for each landing of the own model (docs/features/sounds.md): the bump finder gets the
  // vertical velocity after each physics step, while the body is dynamic and awake. A body that is
  // kinematic (drag, lift), asleep or the other player's starts fresh when it moves again,
  // so a drop, a lift, a jump or a set pose is never a bump.
  useAfterPhysicsStep((physics) => {
    const rb = rigidRef.current
    if (!rb) return
    if (remoteRef.current || !rb.isDynamic() || rb.isSleeping()) {
      bump.current?.reset()
      return
    }
    bump.current ??= createBumpFinder({
      gravity: -WORLD_GRAVITY,
      min: MODEL_BUMP_MIN,
      max: MODEL_BUMP_MAX,
      vertical: true,
    })
    const strength = bump.current.feed(rb.linvel(), physics.timestep)
    if (strength <= 0) return
    const t = rb.translation()
    landed(t.x, t.y, t.z, strength)
  })

  return { listenLanding, remoteBump, livePlace }
}
