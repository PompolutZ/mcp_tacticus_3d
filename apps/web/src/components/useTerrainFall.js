import { useEffect, useRef } from 'react'
import { BASE_DIAMETER } from '../characters/files.js'
import { modelKey } from '../characters/claims.js'
import { upright } from '../characters/base.js'
import { planTerrainDrop } from '../terrain/dropQuery.js'
import { poseOf } from '../rooms/table.js'

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
  // { terrain: { id: delta } } for App to store, and keeps the model falls for the effect below, which
  // runs after the piece left the world. A model that the other player moves, a lifted one and one that
  // is dragged here is not planned. Delta: inches straight down.
  const pendingDrops = useRef({})
  function planFall(removedId) {
    const world = worldRef.current
    const rapier = rapierRef.current
    pendingDrops.current = {}
    if (!world || !rapier) return { terrain: {} }
    const list = []
    for (const model of models) {
      const body = liveCharBody(model.id)
      if (!body || ownership?.owner(modelKey(model.id)) === 'other') continue
      if (charLifts.current.get(model.id)?.isBusy()) continue
      const t = body.translation()
      list.push({ id: model.id, x: t.x, y: t.y, z: t.z, radius: BASE_DIAMETER[model.base] / 2 })
    }
    const plan = planTerrainDrop({
      world,
      rapier,
      removedId,
      terrainObjects: terrainObjects.current,
      models: list,
    })
    pendingDrops.current = plan.models
    return plan
  }

  // The models of the plan go straight down to the next surface, upright, with no speed, so nothing is
  // pushed. The pose is stored as at a rest (returnModels), so the other browser gets it. Runs after the
  // render that removed the piece, when its colliders are gone.
  useEffect(() => {
    const drops = pendingDrops.current
    pendingDrops.current = {}
    for (const [id, delta] of Object.entries(drops)) {
      const body = liveCharBody(id)
      if (!body || !claimModel(id)) continue
      const t = body.translation()
      const pose = poseOf({ x: t.x, y: t.y - delta, z: t.z }, upright(body.rotation()))
      applyPose(id, pose)
      onModelRest?.(id, pose)
    }
    // applyPose and claimModel only read refs and the render's models
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrain])

  return planFall
}
