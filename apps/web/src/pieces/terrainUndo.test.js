import test from 'node:test'
import assert from 'node:assert/strict'
import {
  deleteEntryData,
  undoPlan,
  planRises,
  SAME_POSE_MOVE,
  SAME_POSE_TURN,
} from './terrainUndo.js'

const pose = { x: 1, y: 0.5, z: 2, qx: 0, qy: 0, qz: 0, qw: 1 }
const placed = [
  { id: 'a', piece: 'crystals', position: [0, 1, 0] },
  { id: 'b', piece: 'crystals', position: [5, 3, 5] },
]
const storedPiece = { id: 'a', index: 0, locked: false }
const stored = [{ id: 'b', index: 1, locked: true, y: 3 }]
const fall = { terrain: { b: 2 }, models: { m1: { delta: 1.5, pose } } }

function entry() {
  return deleteEntryData(storedPiece, 'map', 'map', placed, fall)
}

test('the entry keeps the piece, the map and the falls', () => {
  const e = entry()
  assert.deepEqual(e.piece, storedPiece)
  assert.equal(e.pieceKey, 'crystals')
  assert.equal(e.mapId, 'map')
  assert.deepEqual(e.terrain, [{ id: 'b', from: 3, to: 1 }])
  assert.deepEqual(e.models, [{ id: 'm1', delta: 1.5, pose }])
})

test('undo puts the piece back with its id, and what fell back up', () => {
  const now = [{ id: 'b', position: [5, 1, 5] }]
  const plan = undoPlan(entry(), [{ ...stored[0], y: 1 }], now)
  assert.deepEqual(plan.terrain.at(-1), storedPiece)
  assert.equal(plan.terrain.find((p) => p.id === 'b').y, 3)
  assert.deepEqual(planRises(entry().models, { m1: pose }, {}), [
    { id: 'm1', pose: { ...pose, y: 2 } },
  ])
})

test('a piece moved after the fall keeps its place', () => {
  const now = [{ id: 'b', position: [5, 4, 5] }]
  const plan = undoPlan(entry(), [{ ...stored[0], y: 4 }], now)
  assert.equal(plan.terrain.find((p) => p.id === 'b').y, 4)
})

test('a model that moved after the fall stays', () => {
  assert.deepEqual(planRises(entry().models, { m1: { ...pose, x: 9 } }, {}), [])
})

test('a model that settled a little after the fall still rises', () => {
  const settled = { ...pose, y: pose.y + SAME_POSE_MOVE / 5, x: pose.x - SAME_POSE_MOVE / 5 }
  const rises = planRises(entry().models, { m1: settled }, {})
  assert.deepEqual(
    rises.map((r) => r.id),
    ['m1'],
  )
})

test('a model turned or moved by the player stays', () => {
  const half = (SAME_POSE_TURN * 4) / 2
  const turned = { ...pose, qy: Math.sin(half), qw: Math.cos(half) }
  assert.deepEqual(planRises(entry().models, { m1: turned }, {}), [])
  const moved = { ...pose, z: pose.z + SAME_POSE_MOVE * 4 }
  assert.deepEqual(planRises(entry().models, { m1: moved }, {}), [])
})

const liftedModels = [{ id: 'm1', delta: 1.5, pose, lifted: true }]

test('the entry marks a model that was lifted', () => {
  const lifted = { terrain: {}, models: { m1: { delta: 1.5, pose, lifted: true } } }
  assert.deepEqual(deleteEntryData(storedPiece, 'map', 'map', placed, lifted).models, liftedModels)
})

test('a lifted model that was lowered rises, even if turned in the lift', () => {
  const half = (SAME_POSE_TURN * 4) / 2
  const turned = { ...pose, qy: Math.sin(half), qw: Math.cos(half) }
  assert.deepEqual(planRises(liftedModels, { m1: turned }, {}), [
    { id: 'm1', pose: { ...pose, y: 2 } },
  ])
})

test('a model that is still lifted raises its lift place, by the stored pose it ignores', () => {
  const rest = { x: pose.x, y: pose.y, z: pose.z }
  const oldStored = { ...pose, y: 9 }
  assert.deepEqual(planRises(liftedModels, { m1: oldStored }, { m1: rest }), [
    { id: 'm1', delta: 1.5 },
  ])
})

test('a lifted model that was moved stays', () => {
  const rest = { x: pose.x + SAME_POSE_MOVE * 4, y: pose.y, z: pose.z }
  assert.deepEqual(planRises(liftedModels, { m1: pose }, { m1: rest }), [])
  assert.deepEqual(planRises(liftedModels, { m1: { ...pose, x: 9 } }, {}), [])
})
