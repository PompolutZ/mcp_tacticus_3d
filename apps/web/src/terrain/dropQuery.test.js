import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { BoxGeometry, Mesh } from 'three'
import { planTerrainDrop } from './dropQuery.js'

const require = createRequire(import.meta.resolve('@react-three/rapier'))
let rapier
let world

// A fixed box with the piece id in the userData of its body, as Terrain.jsx does
function piece(id, { x, y, z }, half) {
  const body = world.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(x, y, z))
  body.userData = { id }
  world.createCollider(rapier.ColliderDesc.cuboid(half, half, half), body)
  const mesh = new Mesh(new BoxGeometry(half * 2, half * 2, half * 2))
  mesh.position.set(x, y, z)
  mesh.updateMatrixWorld(true)
  return mesh
}

let objects

before(async () => {
  rapier = require('@dimforge/rapier3d-compat')
  await rapier.init()
  world = new rapier.World({ x: 0, y: -30, z: 0 })
  world.createCollider(rapier.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0))
  // Piece a: box on the table, top at 2. Piece b: box on top of a, top at 4.
  objects = new Map([
    ['a', piece('a', { x: 0, y: 1, z: 0 }, 1)],
    ['b', piece('b', { x: 0, y: 3, z: 0 }, 1)],
  ])
  world.step()
})

test('removing a piece drops the piece and the model that stand on it', () => {
  const plan = planTerrainDrop({
    world,
    rapier,
    removedId: 'a',
    terrainObjects: objects,
    models: [
      { id: 'm1', x: 0, y: 4, z: 0, radius: 0.5 },
      { id: 'm2', x: 20, y: 0, z: 0, radius: 0.5 },
    ],
  })
  assert.ok(Math.abs(plan.terrain.b - 2) < 0.05, JSON.stringify(plan))
  assert.ok(Math.abs(plan.models.m1 - 2) < 0.05, JSON.stringify(plan))
  assert.equal(plan.models.m2, undefined)
})
