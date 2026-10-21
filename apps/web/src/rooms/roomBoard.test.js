import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAPS } from '../terrain/maps/index.js'
import { mapFace } from '../terrain/mapFace.js'
import { roomList } from './roomList.js'
import { orphanImageCodes } from './roomImage.js'
import { serverRoomBoard, singleRoomBoard } from './roomBoard.js'

const mapId = Object.keys(MAPS)[0]

test('a room on a normal map has no board card', () => {
  assert.equal(singleRoomBoard({ mapId }), null)
  assert.equal(serverRoomBoard({ mapId }), null)
  assert.equal(serverRoomBoard({ mapId: null }), null)
})

test('single room: name and author come from the copy in the record, not from the account', () => {
  const room = { mapId: 'custom', board: { name: ' Docks ', author: 'Ann' } }
  assert.deepEqual(singleRoomBoard(room), { name: 'Docks', author: 'Ann', hasImage: true })
  assert.deepEqual(singleRoomBoard({ mapId: 'custom', board: { name: '', author: '' } }), {
    name: 'My board',
    author: '',
    hasImage: true,
  })
})

test('multiplayer room: the card reads the fields of the API room', () => {
  const room = { mapId: 'custom', boardName: 'Docks', boardAuthor: 'Ann', hasImage: false }
  assert.deepEqual(serverRoomBoard(room), { name: 'Docks', author: 'Ann', hasImage: false })
  assert.deepEqual(serverRoomBoard({ mapId: 'custom' }), {
    name: 'My board',
    author: '',
    hasImage: false,
  })
})

test('the lobby list carries the board of each custom room, null for the others', () => {
  const list = roomList(
    [
      { id: 'S1', mapId: 'custom', board: { name: 'A', author: 'x' }, rosters: {}, updatedAt: 2 },
      { id: 'S2', mapId, rosters: {}, updatedAt: 1 },
    ],
    [],
  )
  assert.equal(list[0].board.name, 'A')
  assert.equal(list[1].board, null)
})

test('the map face takes the name of the copy, else My board', () => {
  assert.equal(mapFace('custom', 'Docks').name, 'Docks')
  assert.equal(mapFace('custom').name, 'My board')
  assert.equal(mapFace(mapId, 'Docks').name, MAPS[mapId].name)
})

test('stored images of rooms that are gone are orphans', () => {
  assert.deepEqual(orphanImageCodes(['A', 'B'], ['A']), ['B'])
  assert.deepEqual(orphanImageCodes([], ['A']), [])
})
