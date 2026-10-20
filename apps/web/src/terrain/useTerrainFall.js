import { useEffect, useRef } from 'react'
import { BASE_DIAMETER } from '../characters/files.js'
import { modelKey } from '../characters/claims.js'
import { upright } from '../characters/base.js'
import { planTerrainDrop } from './dropQuery.js'
import { poseOf } from '../rooms/table.js'
import { planRises } from '../pieces/terrainUndo.js'
import { useLatest } from '../scene/useLatest.js'

// The model falls when a terrain piece is deleted: the plan (planFall, called through sceneApi) and
// the effect that applies it after the piece left the world.
export function useTerrainFall({
  models,
  liveCharBody,
  charLifts,
  ownership,
  worldRef,
  rapierRef,
  terrainObjects,
  terrain,
  claimModel,
  applyPose,
  onModelRest,
}) {
  // A terrain piece is about to be deleted (App, handleTerrainRemove): plans what stood on it. Returns
  // { terrain: { id: delta }, models: { id: { delta, pose } } } for App to store (the delete entry, for
  // the undo), and keeps the poses after the fall for the effect below, which runs after the piece left the
  // world. A model that the other player moves, or that is dragged or slid here, is not planned. A lifted
  // one is planned from its place before the lift, but it does not move: its lift gets the new place
  // (dropRest) and it lowers onto the new surface. It is in the result with lifted: true, pose = that new
  // place, so the undo raises its lift place.
  // Delta: inches straight down. pose: the stored pose after the fall.
  const pendingPoses = useRef({})
  function planFall(removedId) {
    const world = worldRef.current
    const rapier = rapierRef.current
    pendingPoses.current = {}
    if (!world || !rapier) return { terrain: {}, models: {} }
    const list = []
    const lifted = new Map()
    for (const model of models) {
      const body = liveCharBody(model.id)
      if (!body || ownership?.owner(modelKey(model.id)) === 'other') continue
      const lift = charLifts.current.get(model.id)
      // A lift ends a drag and a slide when it starts, so a lifted model is not dragged or sliding
      const rest = lift?.restPosition()
      if (lift?.isBusy() && !rest) continue
      if (rest) lifted.set(model.id, rest)
      const t = rest ?? body.translation()
      list.push({ id: model.id, x: t.x, y: t.y, z: t.z, radius: BASE_DIAMETER[model.base] / 2 })
    }
    const plan = planTerrainDrop({
      world,
      rapier,
      removedId,
      terrainObjects: terrainObjects.current,
      models: list,
    })
    const falls = {}
    for (const [id, delta] of Object.entries(plan.models)) {
      const body = liveCharBody(id)
      if (!body) continue
      const rest = lifted.get(id)
      if (rest) {
        charLifts.current.get(id)?.dropRest(delta)
        falls[id] = {
          delta,
          lifted: true,
          pose: poseOf({ x: rest.x, y: rest.y - delta, z: rest.z }, upright(body.rotation())),
        }
        continue
      }
      const t = body.translation()
      falls[id] = {
        delta,
        pose: poseOf({ x: t.x, y: t.y - delta, z: t.z }, upright(body.rotation())),
      }
    }
    pendingPoses.current = Object.fromEntries(
      Object.entries(falls)
        .filter(([, m]) => !m.lifted)
        .map(([id, m]) => [id, m.pose]),
    )
    return { terrain: plan.terrain, models: falls }
  }

  // The undo of a delete (App, handleTerrainUndo): models: the entry models, poses: the stored poses now. A model
  // that is still where it fell goes back (planRises). A lifted one gets its lift place raised at once (dropRest
  // with a negative delta), so it lowers onto the piece. The others are applied by the effect below, after the
  // piece is back in the world, like a fall.
  function raiseModels(models, poses) {
    const rests = {}
    for (const m of models) {
      const rest = charLifts.current.get(m.id)?.restPosition()
      if (rest) rests[m.id] = rest
    }
    const rises = planRises(models, poses, rests)
    for (const r of rises) if (!r.pose) charLifts.current.get(r.id)?.dropRest(-r.delta)
    pendingPoses.current = Object.fromEntries(
      rises.filter((r) => r.pose).map((r) => [r.id, r.pose]),
    )
  }

  // The models of the plan go straight down to the next surface (or back up, for an undo), upright, with no
  // speed, so nothing is pushed. The pose is stored as at a rest (returnModels), so the other browser gets
  // it. Runs after the render that changed the piece, when its colliders are gone or back.
  const dropNow = useLatest({ liveCharBody, claimModel, applyPose, onModelRest })
  useEffect(() => {
    const { liveCharBody, claimModel, applyPose, onModelRest } = dropNow.current
    const poses = pendingPoses.current
    pendingPoses.current = {}
    for (const [id, pose] of Object.entries(poses)) {
      if (!liveCharBody(id) || !claimModel(id)) continue
      applyPose(id, pose)
      onModelRest?.(id, pose)
    }
  }, [terrain, dropNow])

  return { planFall, raiseModels }
}
