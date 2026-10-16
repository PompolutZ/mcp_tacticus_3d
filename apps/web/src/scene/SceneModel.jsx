import { Suspense, memo, useCallback, useMemo, useState } from 'react'
import CharacterModel, { StandeeModel } from '../characters/CharacterModel.jsx'
import { modelUrls } from '../characters/modelUrls.js'
import { placementHeld } from '../ui/secureNear.js'
import SpectatorBadge from '../ui/SpectatorBadge.jsx'
import { BASE_DIAMETER } from '../characters/files.js'
import { characterName, characterStamina } from '../characters/characters.js'
import { modelCardFile } from '../characters/models.js'
import { modelKey } from '../characters/claims.js'
import { overlapsAny } from '../characters/overlap.js'
import { assetUrl } from '../assets/index.js'
import { MAT_SIZE } from '../table.js'
import { useTableStore } from '../table/TableStoreContext.jsx'

// One model of a character on the table: the props of its 3D model or standee, made from Scene's data.
// It renders only when its own props change (spawn excepted, see sameProps), so a Scene render does not render every model.
// model, spawn: the model and where it starts (position, quaternion, rotation; the model reads them only on mount).
// claims: the claims of the models (useModelClaims). spectator, held, secureTokens: the spectator badge, only
// given when the spectator view is on. ctx: the same object for the life of Scene, { refs, now }. refs: the
// registry refs and the piece trackers of Scene. now: a ref to the helpers of the last Scene render, which only
// handlers read (a drag, a hover, a rest), so a new helper needs no render here.
// Limits a drag of the model: the deploy lock zone, then the Place limits of the tools. Moves p, returns nothing.
function constrainDrag({ deployLine, deployDepth, applyPlaceLimits }, model, p) {
  if (deployLine) {
    const limit = MAT_SIZE / 2 - deployDepth - BASE_DIAMETER[model.base] / 2
    if (model.character.team === 'host') p.z = Math.max(p.z, limit)
    else p.z = Math.min(p.z, -limit)
  }
  applyPlaceLimits('character', model.id, p)
}

function SceneModel({ model, spawn, claims, spectator, held, secureTokens, contestRange, ctx }) {
  const actions = useTableStore((s) => s.actions)
  const ownership = useTableStore((s) => s.ownership)
  const { refs, now } = ctx
  // Read only on mount, so a later spawn (the tray moved) is not a change
  const [startSpawn] = useState(spawn)
  const props = useMemo(() => {
    const ch = model.character
    const radius = BASE_DIAMETER[model.base] / 2
    const { charBodies, charObjects, charLifts, turnsLeft, hoveredPiece, draggedPiece } = refs
    const { markMoved, trackPiece, startModelDrag, endModelDrag } = refs
    const piece = { kind: 'character', id: model.id }
    return {
      ...startSpawn,
      baseRadius: radius,
      team: ch.team,
      modelId: model.id,
      overlapsAt: (x, y, z) => overlapsAny({ x, y, z, radius }, now.current.modelBases(model.id)),
      onSelect: () => actions.toggleSelect('character', model.id),
      onDragSelect: () => actions.dragSelect('character', model.id),
      onHover: (over) => {
        actions.onPieceHover(piece, over)
        trackPiece(hoveredPiece, piece, over)
        // A construct has no card
        if (!model.construct)
          actions.onCardHover(
            {
              src: assetUrl(modelCardFile(model)),
              alt: characterName(ch.key),
              by: `model:${model.id}`,
            },
            over,
          )
      },
      bodyRef: (rb) =>
        rb ? charBodies.current.set(model.id, rb) : charBodies.current.delete(model.id),
      claimKey: modelKey(model.id),
      ownership: claims,
      onRest: () => {
        // One writer for each rest pose ("Rules" 5)
        if (ownership && !ownership.writes(modelKey(model.id))) return
        const rest = now.current.restPose(model.id)
        if (rest) now.current.onModelRest?.(model.id, rest)
      },
      objectRef: (obj) =>
        obj ? charObjects.current.set(model.id, obj) : charObjects.current.delete(model.id),
      liftRef: (lift) =>
        lift ? charLifts.current.set(model.id, lift) : charLifts.current.delete(model.id),
      onDragStart: () => {
        markMoved(model.id)
        actions.setDraggingCharId(model.id)
        ownership?.setDrag(modelKey(model.id))
        startModelDrag(model.id)
        trackPiece(draggedPiece, piece, true)
      },
      // cancelled: Esc put the body back, so a Q / E turn that is not done yet is dropped
      onDragEnd: (cancelled) => {
        if (cancelled) turnsLeft.current.delete(modelKey(model.id))
        actions.setDraggingCharId(null)
        ownership?.setDrag(null)
        endModelDrag(model.id)
        trackPiece(draggedPiece, piece, false)
      },
      // A base is within range if any part of it is within range (p8). So the base can
      // go as far as touching the far end of the tool: its center is one radius past it.
      constrainDrag: (p) => constrainDrag(now.current, model, p),
    }
  }, [model, startSpawn, claims, actions, ownership, refs, now])
  // The placement is not final: a drag, lift or throw of either player, or the body still moves. The
  // badge shows no Secure token then (docs/features/spectator-view.md).
  const isHeld = useCallback(() => {
    const { charBodies, charLifts, draggedPiece } = refs
    const body = charBodies.current.get(model.id)
    return placementHeld({
      owner: ownership?.owner(modelKey(model.id)),
      dragging: draggedPiece.current?.kind === 'character' && draggedPiece.current.id === model.id,
      lifted: Boolean(charLifts.current.get(model.id)?.isBusy()),
      asleep: body ? body.isSleeping() : true,
    })
  }, [model.id, ownership, refs])
  // The spectator view above the model, which moves with it (CharacterModel.jsx, overlay). A construct has none.
  const overlay = useMemo(() => {
    if (!spectator || model.construct) return undefined
    const ch = model.character
    return (top) => (
      <SpectatorBadge
        character={ch}
        stamina={characterStamina(ch.key, ch.side)}
        top={top}
        baseRadius={BASE_DIAMETER[model.base] / 2}
        held={held}
        secureTokens={secureTokens}
        contestRange={contestRange}
        isHeld={isHeld}
      />
    )
  }, [spectator, model, held, secureTokens, contestRange, isHeld])
  const urls = useMemo(() => modelUrls(model), [model])
  return (
    <Suspense fallback={null}>
      {urls.standee ? (
        <StandeeModel urls={urls.standee} {...props} overlay={overlay} />
      ) : (
        <CharacterModel url={urls.gltf} {...props} overlay={overlay} />
      )}
    </Suspense>
  )
}

// spawn is a new object each Scene render and only read on mount, so it is left out of the comparison
function sameProps(prev, next) {
  return Object.keys(next).every((key) => key === 'spawn' || prev[key] === next[key])
}

export default memo(SceneModel, sameProps)
