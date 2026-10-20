import test from 'node:test'
import assert from 'node:assert/strict'
import { createSceneApi, SCENE_API_KEYS } from './sceneApi.js'

function makeParts() {
  const calls = []
  const spy =
    (name, result) =>
    (...args) => {
      calls.push([name, args])
      return result
    }
  const parts = {
    characterAt: spy('characterAt', 'c1'),
    modelPosition: spy('modelPosition', { x: 1, z: 2 }),
    returnModels: spy('returnModels'),
    turnPiece: spy('turnPiece'),
    liftPiece: spy('liftPiece'),
    floorPiece: spy('floorPiece', 'top'),
    terrainAt: spy('terrainAt', 't1'),
    planFall: spy('planFall', { terrain: {}, models: {} }),
    raiseModels: spy('raiseModels'),
    modelDrag: { current: null },
    addDice: { current: {} },
    toolPoint: { current: null },
  }
  return { parts, calls }
}

test('the key list', () => {
  const api = createSceneApi(makeParts().parts)
  assert.deepEqual(Object.keys(api).sort(), [...SCENE_API_KEYS].sort())
})

test('each wrapper calls its part with the same arguments', () => {
  const { parts, calls } = makeParts()
  const api = createSceneApi(parts)
  const options = { models: false }
  assert.equal(api.characterAt(1, 2, options), 'c1')
  assert.deepEqual(api.modelPosition('a'), { x: 1, z: 2 })
  api.returnModels('b')
  api.turnPiece(-1)
  api.liftPiece()
  assert.equal(api.floorPiece(), 'top')
  assert.equal(api.terrainAt(), 't1')
  assert.deepEqual(api.planFall('t'), { terrain: {}, models: {} })
  api.raiseModels([], {})
  assert.deepEqual(calls, [
    ['characterAt', [1, 2, options]],
    ['modelPosition', ['a']],
    ['returnModels', ['b']],
    ['turnPiece', [-1]],
    ['liftPiece', []],
    ['floorPiece', []],
    ['terrainAt', []],
    ['planFall', ['t']],
    ['raiseModels', [[], {}]],
  ])
})

test('modelDragId and addDice read the refs at the call', () => {
  const { parts } = makeParts()
  const api = createSceneApi(parts)
  assert.equal(api.modelDragId(), null)
  parts.modelDrag.current = 'm1'
  assert.equal(api.modelDragId(), 'm1')
  assert.equal(api.addDice('a', 3), undefined)
  const seen = []
  parts.addDice.current.a = (count) => seen.push(count)
  api.addDice('a', 3)
  assert.deepEqual(seen, [3])
})

test('tool point calls give undefined with no tool point, else the point', () => {
  const { parts } = makeParts()
  const api = createSceneApi(parts)
  assert.equal(api.pointAtPointer(), undefined)
  assert.equal(api.pointAtCenter(), undefined)
  parts.toolPoint.current = { atPointer: () => ({ x: 1 }), atCenter: () => null }
  assert.deepEqual(api.pointAtPointer(), { x: 1 })
  assert.equal(api.pointAtCenter(), null)
})

test('a missing part throws', () => {
  const { parts } = makeParts()
  delete parts.planFall
  assert.throws(() => createSceneApi(parts), /planFall/)
  const other = makeParts().parts
  delete other.toolPoint
  assert.throws(() => createSceneApi(other), /toolPoint/)
})
