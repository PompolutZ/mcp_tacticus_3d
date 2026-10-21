import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAPS } from '../terrain/maps/index.js'
import * as Y from 'yjs'
import { createTable, fillTable } from '../net/doc.js'
import { MATS } from '../terrain/catalog.js'
import {
  applyBoard,
  applyEmptyMat,
  applyMap,
  CUSTOM_MAP_ID,
  fillMap,
  isPlayableMap,
  mapChoice,
  mapTerrain,
  renameBoard,
  startTable,
  tableMat,
  withPlacements,
} from './table.js'
import { canUndo } from '../log/log.js'
import { mapFace } from '../terrain/mapFace.js'

test('mapTerrain ids are mapId:index and the same on every call', () => {
  const mapId = Object.keys(MAPS)[0]
  const first = mapTerrain(mapId)
  assert.deepEqual(
    first.map((p) => p.id),
    first.map((_, i) => `${mapId}:${i}`),
  )
  assert.deepEqual(
    mapTerrain(mapId).map((p) => p.id),
    first.map((p) => p.id),
  )
})

function emptyTableBytes() {
  const doc = new Y.Doc()
  fillTable(createTable(doc), { ...startTable(null), rosters: { host: null, guest: null } })
  return Y.encodeStateAsUpdate(doc)
}

function openTable(bytes) {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, bytes)
  return createTable(doc)
}

test('fillMap writes the map and its terrain once', () => {
  const mapId = Object.keys(MAPS)[0]
  const table = openTable(emptyTableBytes())
  assert.equal(table.game.get('mapId'), null)
  assert.equal(fillMap(table, mapId), true)
  assert.equal(table.game.get('mapId'), mapId)
  assert.equal(table.terrain.read().length, MAPS[mapId].placements.length)
  assert.equal(fillMap(table, Object.keys(MAPS)[1] ?? mapId), false)
  assert.equal(table.game.get('mapId'), mapId)
})

test('fillMap does nothing without a room map or with an unknown one', () => {
  const table = openTable(emptyTableBytes())
  assert.equal(fillMap(table, null), false)
  assert.equal(fillMap(table, 'no-such-map'), false)
  assert.equal(table.game.get('mapId'), null)
  assert.equal(table.terrain.read().length, 0)
})

test('two fills of the same map merge into one set of pieces', () => {
  const mapId = Object.keys(MAPS)[0]
  const bytes = emptyTableBytes()
  const a = openTable(bytes)
  const b = openTable(bytes)
  fillMap(a, mapId)
  fillMap(b, mapId)
  Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc))
  Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc))
  for (const table of [a, b]) {
    assert.equal(table.game.get('mapId'), mapId)
    assert.equal(table.terrain.read().length, MAPS[mapId].placements.length)
  }
})

test('startTable has game.mat null', () => {
  assert.equal(startTable(Object.keys(MAPS)[0]).mat, null)
  assert.equal(startTable(null).mat, null)
})

test('Empty mat writes the mat and an empty terrain in one change; a map brings the mat back', () => {
  const mapId = Object.keys(MAPS)[0]
  const table = openTable(emptyTableBytes())
  applyMap(table, mapId)
  assert.ok(table.terrain.read().length > 0)
  let changes = 0
  table.doc.on('update', () => changes++)
  const mat = MATS[MATS.length - 1]
  applyEmptyMat(table, mat)
  assert.equal(changes, 1)
  assert.equal(table.game.get('mapId'), null)
  assert.deepEqual(table.game.get('mat'), { name: mat.name, rotation: mat.rotation })
  assert.deepEqual(table.terrain.read(), [])
  assert.deepEqual(tableMat(null, table.game.get('mat')), {
    name: mat.name,
    rotation: mat.rotation,
  })
  applyMap(table, mapId)
  assert.equal(table.game.get('mat'), null)
  assert.equal(table.game.get('mapId'), mapId)
})

test('the Map select shows the map, a custom board or the empty mat', () => {
  const mat = { name: MATS[0].name, rotation: 0 }
  assert.equal(mapChoice('m', null, 3), 'm')
  assert.equal(mapChoice(null, mat, 0), `mat:${mat.name}`)
  assert.equal(mapChoice(null, mat, 2), CUSTOM_MAP_ID)
  assert.equal(mapChoice(null, null, 0), '')
})

test("readers tolerate mapId 'custom': no map data, fillMap writes nothing, the mat is game.mat", () => {
  const table = createTable(new Y.Doc())
  assert.equal(fillMap(table, 'custom'), false)
  assert.deepEqual(withPlacements('custom', [{ id: 'a', index: 0, locked: true }]), [])
  assert.equal(tableMat('custom', null), null)
  assert.equal(isPlayableMap('custom'), true)
  assert.equal(mapFace('custom').name, 'My board')
  // A guest of a room on the board does not get a map over it
  fillTable(table, { ...startTable('custom'), rosters: { host: null, guest: null } })
  assert.equal(fillMap(table, Object.keys(MAPS)[0]), false)
  assert.equal(table.game.get('mapId'), 'custom')
})

test('a rename keeps the suffix, and the board record outlives the panel', () => {
  const table = openTable(emptyTableBytes())
  renameBoard(table, 'First')
  const { suffix, key } = table.game.get('board')
  renameBoard(table, 'Second')
  assert.deepEqual(table.game.get('board'), { key, name: 'Second', author: '', id: null, suffix })
  // A reload or a Build toggle reads the same record from the document
  const again = openTable(Y.encodeStateAsUpdate(table.doc))
  assert.equal(again.game.get('board').name, 'Second')
  assert.equal(again.game.get('board').suffix, suffix)
})

test('a loaded map and an import write the board record with the fixed id', () => {
  const mapId = Object.keys(MAPS)[0]
  const table = openTable(emptyTableBytes())
  applyMap(table, mapId)
  assert.equal(table.game.get('board').key, mapId)
  assert.equal(table.game.get('board').id, mapId)
  assert.equal(table.game.get('board').name, MAPS[mapId].name)
  const mat = { name: MATS[0].name, rotation: 0 }
  applyBoard(table, mat, [], { name: 'Mine', author: 'Me', id: 'mine-ab12' })
  const board = table.game.get('board')
  assert.deepEqual([board.name, board.author, board.id], ['Mine', 'Me', 'mine-ab12'])
})

test('Undo is off after another board replaces the table, though mapId stays null', () => {
  const table = openTable(emptyTableBytes())
  const mat = { name: MATS[0].name, rotation: 0 }
  applyBoard(table, mat, [], { name: 'A' })
  const entry = {
    kind: 'terrainDeleted',
    piece: { id: 'x:1' },
    boardKey: table.game.get('board').key,
    mapId: null,
  }
  const same = () => canUndo(entry, [], table.game.get('board').key, table.game.get('mapId'))
  assert.equal(same(), true)
  applyBoard(table, mat, [], { name: 'B' })
  assert.equal(same(), false)
  applyBoard(table, mat, [], { name: 'A' })
  applyEmptyMat(table, mat)
  assert.equal(same(), false)
})
