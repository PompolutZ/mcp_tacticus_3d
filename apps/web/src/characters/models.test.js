import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  characterModels,
  characterOnBoard,
  isConstructId,
  modelCharacterId,
  modelCardFile,
  modelFigureYaw,
  SCAN_FIGURE_YAW,
  modelSpawnYaw,
  removalOf,
  yawQuaternion,
} from './models.js'
import { characterCard, characterConstruct, characterModel, transformCard } from './files.js'

const ch = { id: 'c1', key: 'hulk', figure: 'model', base: 'medium', rotation: 0 }
const two = { ...ch, transform: { figure: 'model', card: true } }
const pose = (x, z) => ({ x, y: 0, z, qx: 0, qy: 0, qz: 0, qw: 1 })

test('a pose on the mat is on the board', () => {
  assert.equal(characterOnBoard(ch, { c1: pose(3, -10) }), true)
})

test('the mat edge is on the board', () => {
  assert.equal(characterOnBoard(ch, { c1: pose(18, -18) }), true)
})

test('a pose on the tray, outside the mat, is off the board', () => {
  assert.equal(characterOnBoard(ch, { c1: pose(0, 25) }), false)
  assert.equal(characterOnBoard(ch, { c1: pose(-30, 0) }), false)
})

test('no pose is off the board', () => {
  assert.equal(characterOnBoard(ch, {}), false)
  assert.equal(characterOnBoard(ch, undefined), false)
})

test('only the second model on the mat is on the board', () => {
  const poses = { c1: pose(0, 25), 'c1:2': pose(5, 5) }
  assert.equal(characterOnBoard(two, poses), true)
  assert.equal(characterOnBoard(ch, poses), false)
})

test('blue and red models spawn 180 degrees apart', () => {
  const turn = Math.abs(modelSpawnYaw('guest') - modelSpawnYaw('host'))
  assert.ok(Math.abs(turn - Math.PI) < 1e-9)
})

test('a standee has no model part of the turn', () => {
  assert.equal(modelFigureYaw({ figure: 'standee', rotation: 330 }), 0)
})

test('the model part is the import turn minus cModelRot', () => {
  assert.ok(Math.abs(modelFigureYaw({ figure: 'model', rotation: 180 })) < 1e-9)
  assert.ok(Math.abs(modelFigureYaw({ figure: 'model', rotation: 90 }) - Math.PI / 2) < 1e-9)
  assert.ok(Math.abs(modelFigureYaw({ figure: 'model', rotation: 0 }) - Math.PI) < 1e-9)
})

test('the blue body starts with no turn', () => {
  assert.equal(modelSpawnYaw('host'), 0)
  const q = yawQuaternion(modelSpawnYaw('guest'))
  assert.ok(Math.abs(Math.abs(q.y) - 1) < 1e-9 && Math.abs(q.w) < 1e-9)
})

test('a model shows the card of its character, the side that faces up', () => {
  const [first] = characterModels({ ...ch, side: 'injured' })
  assert.equal(modelCardFile(first), characterCard('hulk', 'injured'))
})

test('the second model with its own card shows that card, a spare model the first card', () => {
  const [first, second] = characterModels({ ...two, side: 'healthy' })
  assert.equal(modelCardFile(second), transformCard('hulk', 'healthy'))
  assert.equal(modelCardFile(first), characterCard('hulk', 'healthy'))
  const [, spare] = characterModels({ ...ch, side: 'healthy', transform: { figure: 'model' } })
  assert.equal(modelCardFile(spare), characterCard('hulk', 'healthy'))
})

const magneto = { ...ch, id: 'm1', key: 'magneto', constructs: 2 }

test('constructs are small models after the other models, with their own ids', () => {
  const models = characterModels({ ...magneto, transform: { figure: 'model' } })
  assert.deepEqual(
    models.map((m) => m.id),
    ['m1', 'm1:2', 'm1:c1', 'm1:c2'],
  )
  const [, , c1] = models
  assert.equal(c1.construct, true)
  assert.equal(c1.base, 'small')
  assert.equal(c1.card, null)
  assert.equal(c1.file, characterConstruct('magneto', 1))
  assert.equal(modelCharacterId('m1:c2'), 'm1')
  assert.equal(modelCharacterId('m1:2'), 'm1')
  assert.equal(isConstructId('m1:c2'), true)
  assert.equal(isConstructId('m1:2'), false)
  assert.equal(isConstructId('m1'), false)
})

test('no constructs field or 0 gives no construct models', () => {
  assert.equal(characterModels(ch).length, 1)
  assert.equal(characterModels({ ...ch, constructs: 0 }).length, 1)
})

test('a construct on the mat is not the character on the mat', () => {
  assert.equal(characterOnBoard(magneto, { 'm1:c1': pose(0, 0) }), false)
  assert.equal(characterOnBoard(magneto, { m1: pose(25, 0), 'm1:c1': pose(0, 0) }), false)
  assert.equal(characterOnBoard(magneto, { m1: pose(0, 0) }), true)
})

test('removalOf: the host with its grunts and every model of them', () => {
  const host = { ...ch, id: 'h', constructs: 1 }
  const g1 = { ...ch, id: 'g1', key: 'twisty', host: 'h' }
  const g2 = { ...ch, id: 'g2', key: 'fisty', host: 'h' }
  const other = { ...ch, id: 'o' }
  const out = removalOf([host, other, g1, g2], 'h')
  assert.deepEqual(out.characters, ['h', 'g1', 'g2'])
  assert.deepEqual(out.models, ['h', 'h:c1', 'g1', 'g2'])
})

test('removalOf: a grunt alone, or an unknown id, removes nothing', () => {
  const host = { ...ch, id: 'h' }
  const grunt = { ...ch, id: 'g1', host: 'h' }
  assert.deepEqual(removalOf([host, grunt], 'g1'), { characters: [], models: [] })
  assert.deepEqual(removalOf([host, grunt], 'zz'), { characters: [], models: [] })
})

// World direction (x, z) of the local +z of a model on the table: turn of the figure, then the body turn of its team
const frontOf = (model, team) => {
  const yaw = modelFigureYaw(model) + modelSpawnYaw(team)
  return [Math.sin(yaw), Math.cos(yaw)]
}

test('a scan ignores rotation: its local +z faces the board for host and guest', () => {
  const scan = {
    figure: 'model',
    rotation: 90,
    character: { key: 'gamora' },
    file: characterModel('gamora'),
  }
  assert.equal(modelFigureYaw(scan), SCAN_FIGURE_YAW)
  // The host sits at +z and faces -z, the guest at -z and faces +z
  const host = frontOf(scan, 'host')
  const guest = frontOf(scan, 'guest')
  assert.ok(Math.abs(host[0]) < 1e-9 && Math.abs(host[1] + 1) < 1e-9)
  assert.ok(Math.abs(guest[0]) < 1e-9 && Math.abs(guest[1] - 1) < 1e-9)
})

test('a TTS model keeps its rotation, also when a scan of another character exists', () => {
  const tts = {
    figure: 'model',
    rotation: 90,
    character: { key: 'iron-man' },
    file: characterModel('iron-man'),
  }
  assert.ok(Math.abs(modelFigureYaw(tts) - Math.PI / 2) < 1e-9)
  // The transform file of a scanned character is a TTS file
  const second = { ...tts, character: { key: 'gamora' }, file: 'characters/gamora/transform.glb' }
  assert.ok(Math.abs(modelFigureYaw(second) - Math.PI / 2) < 1e-9)
})
