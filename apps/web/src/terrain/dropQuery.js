import { Box3 } from 'three'
import { castAlongHit } from '../physics.js'
import { BASE_HALF_H } from '../components/CharacterModel.jsx'
import { STAND_GAP, STAND_LIFT, dropPlan, fallDelta, sampleGrid, standsOnIds } from './dropDown.js'

const DOWN = { x: 0, y: -1, z: 0 }
const NO_ROTATION = { x: 0, y: 0, z: 0, w: 1 }
const RAY_ROOM = 50

// Id of the terrain piece that a collider belongs to (the userData of its RigidBody, see Terrain.jsx), or
// null: the table and anything else without an id
const ownerId = (collider) => collider.parent()?.userData?.id ?? null

// The first fixed collider under (x, y, z) that keep(collider) accepts: { y, id } or null
function rayDown(world, rapier, x, y, z, keep) {
  const flags = rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS
  const hit = world.castRay(
    new rapier.Ray({ x, y, z }, DOWN),
    y + RAY_ROOM,
    true,
    flags,
    undefined,
    undefined,
    undefined,
    keep,
  )
  return hit && { y: y - hit.timeOfImpact, id: ownerId(hit.collider) }
}

// The bottom and the sample points under a piece. A point counts when a ray from above hits the piece
// there, so the corner of a turned box that is outside the piece is left out.
function pieceFootprint(world, rapier, id, object) {
  const box = new Box3().setFromObject(object)
  const points = sampleGrid({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z })
  const under = points.filter(
    (p) => rayDown(world, rapier, p.x, box.max.y + 0.5, p.z, (c) => ownerId(c) === id) !== null,
  )
  return { bottom: box.min.y, points: under.length ? under : points }
}

// What falls when the terrain piece removedId is deleted: { terrain: { id: delta }, models: { id: delta } }
// (delta in inches, straight down). Call it before the piece leaves the world.
// terrainObjects: Map piece id → its mesh. models: [{ id, x, y, z, radius }], y is the base bottom.
export function planTerrainDrop({ world, rapier, removedId, terrainObjects, models }) {
  const pieces = new Map()
  for (const [id, object] of terrainObjects) {
    if (id !== removedId) pieces.set(id, pieceFootprint(world, rapier, id, object))
  }
  const standsOn = {}
  for (const [id, { bottom, points }] of pieces) {
    const hits = points.flatMap(({ x, z }) => {
      const hit = rayDown(world, rapier, x, bottom + STAND_LIFT, z, (c) => ownerId(c) !== id)
      return hit ? [{ id: hit.id, gap: bottom - hit.y }] : []
    })
    standsOn[`terrain:${id}`] = standsOnIds(hits)
  }
  const shapes = new Map()
  const baseShape = (radius) => {
    if (!shapes.has(radius)) shapes.set(radius, new rapier.Cylinder(BASE_HALF_H, radius))
    return shapes.get(radius)
  }
  // The first fixed collider under a base that keep accepts
  const baseCast = (m, distance, keep) =>
    castAlongHit(
      world,
      rapier,
      baseShape(m.radius),
      NO_ROTATION,
      { x: m.x, y: m.y + STAND_LIFT + BASE_HALF_H, z: m.z },
      DOWN,
      distance,
      keep,
    )
  for (const m of models) {
    const { collider } = baseCast(m, STAND_LIFT + STAND_GAP, () => true)
    const id = collider && ownerId(collider)
    standsOn[`model:${m.id}`] = id ? [id] : []
  }
  const modelOf = new Map(models.map((m) => [`model:${m.id}`, m]))
  const landing = (key) => {
    const without = (c) => ownerId(c) !== removedId
    const model = modelOf.get(key)
    if (model) {
      const { distance, collider } = baseCast(model, model.y + STAND_LIFT + 1, without)
      return collider ? Math.max(0, distance - STAND_LIFT) : 0
    }
    const id = key.slice('terrain:'.length)
    const { bottom, points } = pieces.get(id)
    const surfaces = points.flatMap(({ x, z }) => {
      const hit = rayDown(
        world,
        rapier,
        x,
        bottom + STAND_LIFT,
        z,
        (c) => ownerId(c) !== id && ownerId(c) !== removedId,
      )
      return hit ? [hit.y] : []
    })
    return fallDelta(bottom, surfaces)
  }
  const out = { terrain: {}, models: {} }
  for (const { key, delta } of dropPlan({ removedId, standsOn, landing })) {
    if (key.startsWith('terrain:')) out.terrain[key.slice('terrain:'.length)] = delta
    else out.models[key.slice('model:'.length)] = delta
  }
  return out
}
