import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAP_IDS, carouselIds, myBoardChoice } from './myBoard.js'
import { MATS } from '../terrain/catalog.js'

const saved = (name = '', author) => ({
  id: 'x',
  name,
  author,
  mat: MATS[0].name,
  matRotation: 0,
  placements: [],
})

test('no saved board gives no card', () => {
  assert.equal(myBoardChoice(null), null)
  assert.deepEqual(carouselIds(myBoardChoice(null)), MAP_IDS)
})

test('a saved board that is not good gives no card', () => {
  assert.equal(myBoardChoice({ mat: 'no such mat', placements: [] }), null)
})

test('a saved board adds the card after the maps, named by the board or "My board"', () => {
  const named = myBoardChoice(saved('Docks'))
  assert.equal(named.name, 'Docks')
  assert.equal(myBoardChoice(saved('  ')).name, 'My board')
  assert.deepEqual(carouselIds(named), [...MAP_IDS, 'custom'])
})

test('the card carries the author of the saved board, empty when there is none', () => {
  assert.equal(myBoardChoice(saved('Docks', 'Ann')).author, 'Ann')
  assert.equal(myBoardChoice(saved('Docks')).author, '')
})

test('the maps of a random room never include the board', () => {
  assert.ok(!MAP_IDS.includes('custom'))
})
