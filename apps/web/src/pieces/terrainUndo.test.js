import test from 'node:test'
import assert from 'node:assert/strict'
import { deleteEntryData, undoPlan } from './terrainUndo.js'

const pose = { x: 1, y: 0.5, z: 2, qx: 0, qy: 0, qz: 0, qw: 1 }
const placed = [
  { id: 'a', piece: 'crystals', position: [0, 1, 0] },
  { id: 'b', piece: 'crystals', position: [5, 3, 5] },
]
const storedPiece = { id: 'a', index: 0, locked: false }
const stored = [{ id: 'b', index: 1, locked: true, y: 3 }]
const fall = { terrain: { b: 2 }, models: { m1: { delta: 1.5, pose } } }

function entry() {
  return deleteEntryData(storedPiece, 'map', placed, fall)
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
  const plan = undoPlan(entry(), [{ ...stored[0], y: 1 }], now, { m1: pose })
  assert.deepEqual(plan.terrain.at(-1), storedPiece)
  assert.equal(plan.terrain.find((p) => p.id === 'b').y, 3)
  assert.deepEqual(plan.rises, [{ id: 'm1', pose: { ...pose, y: 2 } }])
})

test('a piece moved after the fall keeps its place', () => {
  const now = [{ id: 'b', position: [5, 4, 5] }]
  const plan = undoPlan(entry(), [{ ...stored[0], y: 4 }], now, { m1: pose })
  assert.equal(plan.terrain.find((p) => p.id === 'b').y, 4)
})

test('a model that moved after the fall stays', () => {
  const now = [{ id: 'b', position: [5, 1, 5] }]
  const plan = undoPlan(entry(), stored, now, { m1: { ...pose, x: 9 } })
  assert.deepEqual(plan.rises, [])
})
