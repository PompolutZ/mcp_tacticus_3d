import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useLatest } from './useLatest.js'
import { claimChanges, claimCheck, modelIdOfKey, modelKey } from '../characters/claims.js'
import { setDynamic } from '../physics.js'
import { poseOf } from '../rooms/table.js'

// Two stored poses are the same (both rounded the same way, rooms/table.js, poseOf)
function samePose(a, b) {
  return (
    Boolean(a && b) &&
    a.x === b.x &&
    a.y === b.y &&
    a.z === b.z &&
    a.qx === b.qx &&
    a.qy === b.qy &&
    a.qz === b.qz &&
    a.qw === b.qw
  )
}

// Frames a body waits after a pose is set, before it is put to sleep. A sleeping body is not synced to its
// mesh, so the mesh must follow the new pose first.
const SLEEP_AFTER_FRAMES = 2

// The pose sync of Scene: puts bodies at stored poses, puts them to sleep, ends the own claims, and follows
// the other browser's poses and claims. Scene calls it after usePieceTurns (the claim frame reads turnsLeft).
export function useModelSync({
  ownership,
  poses,
  models,
  liveCharBody,
  charLifts,
  turnsLeft,
  claimTimes,
  restPose,
  onModelRest,
  markMoved,
}) {
  // Model id → frames until its body is put to sleep after a pose
  const sleepLater = useRef(new Map())
  // The newest poses, and the poses of the last render
  const posesRef = useRef(poses)
  const prevPoses = useRef(poses)

  // Puts a model body at a stored pose: dynamic, exact, and asleep a few frames later ("Rules" 6)
  function applyPose(id, pose) {
    const body = liveCharBody(id)
    if (!body) return
    setDynamic(body)
    body.setTranslation({ x: pose.x, y: pose.y, z: pose.z }, true)
    body.setRotation({ x: pose.qx, y: pose.qy, z: pose.qz, w: pose.qw }, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    sleepLater.current.set(id, SLEEP_AFTER_FRAMES)
  }

  // The claim check of the own model claims ("Rules" 2, 6), and the bodies that wait to sleep. A claim ends
  // when the body is dynamic and asleep and nothing of this browser moves the model. The rest pose goes
  // to the document first, then the release, so the other browser gets the pose first.
  useFrame(() => {
    for (const [id, frames] of sleepLater.current) {
      if (frames > 1) {
        sleepLater.current.set(id, frames - 1)
        continue
      }
      sleepLater.current.delete(id)
      const body = liveCharBody(id)
      if (body?.isDynamic() && ownership?.owner(modelKey(id)) !== 'other') body.sleep()
    }
    if (!ownership) return
    const now = performance.now() / 1000
    for (const key of ownership.mine()) {
      const id = modelIdOfKey(key)
      if (id === null) continue
      const body = liveCharBody(id)
      const action = claimCheck({
        age: now - (claimTimes.current.get(key) ?? -Infinity),
        dynamic: body?.isDynamic() ?? false,
        asleep: body?.isSleeping() ?? false,
        busy: Boolean(charLifts.current.get(id)?.isBusy()) || turnsLeft.current.has(key),
        gone: !body || !models.some((model) => model.id === id),
      })
      if (action === 'keep') continue
      if (action === 'rest') {
        const rest = restPose(id)
        if (rest) onModelRest?.(id, rest)
      }
      claimTimes.current.delete(key)
      ownership.release(key)
    }
  })

  // A lost tie ("Rules" 8): a turn left for that model is removed. The drag and lift stop in the
  // model (CharacterModel.jsx, remote).
  useEffect(() => ownership?.onLost((key) => turnsLeft.current.delete(key)), [ownership, turnsLeft])

  useEffect(() => {
    posesRef.current = poses
  })
  // The models and functions of the newest render, for the effects below that run only on a change of poses or claims
  const latest = useLatest({ ownership, models, liveCharBody, applyPose, markMoved })

  // Rest poses from the other browser ("Rules", end). A model that nobody claims, with a changed pose that
  // the body does not stand at: the body goes there. A pose that this browser wrote equals the body.
  // A model that this browser claims ignores it. A model that the other player claims waits (below).
  useEffect(() => {
    const { ownership, models, liveCharBody } = latest.current
    const prev = prevPoses.current
    prevPoses.current = poses
    if (prev === poses) return
    for (const model of models) {
      const entry = poses[model.id]
      if (!entry || samePose(entry, prev[model.id])) continue
      if (ownership?.owner(modelKey(model.id)) != null) continue
      const body = liveCharBody(model.id)
      if (!body || samePose(poseOf(body.translation(), body.rotation()), entry)) continue
      latest.current.applyPose(model.id, entry)
    }
  }, [poses, latest])

  // The other player's claims start and end ("Rules"). prev, next: the Sets of their claims before and after. Scene.jsx
  // calls it from ClaimSync, so a claim change renders that component, not Scene.
  function onOtherClaims(prev, next) {
    const { ownership, liveCharBody } = latest.current
    const present = ownership?.otherPresent() ?? false
    const { started, ended, gone } = claimChanges(prev, next, present)
    for (const key of started) {
      const id = modelIdOfKey(key)
      if (id !== null) latest.current.markMoved(id)
    }
    for (const key of ended) {
      const id = modelIdOfKey(key)
      if (id === null || ownership.owner(key) === 'me') continue
      const pose = posesRef.current[id]
      if (pose) latest.current.applyPose(id, pose)
      else {
        const b = liveCharBody(id)
        if (b) setDynamic(b)
      }
    }
    // The other player is gone: the body stays where it is and awake. This browser writes its rest pose.
    for (const key of gone) {
      const id = modelIdOfKey(key)
      const body = id === null ? null : liveCharBody(id)
      if (body && ownership.owner(key) !== 'me') {
        setDynamic(body)
        body.wakeUp()
      }
    }
  }

  return { applyPose, onOtherClaims }
}
