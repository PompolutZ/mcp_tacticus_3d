import test from 'node:test'
import assert from 'node:assert/strict'
import {
  freePilePlaces,
  tacticPilePlace,
  tacticSlotPosition,
  TACTIC_PLATE_WIDTH,
} from './layout.js'

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)

test('blue: first pile lies 0.3" past the left end of the plate, in the slot row', () => {
  const place = tacticPilePlace('blue', 0)
  near(place.x, -(TACTIC_PLATE_WIDTH / 2 + 0.3 + 0.5))
  near(place.z, tacticSlotPosition('blue', 0).z)
  near(tacticPilePlace('blue', 1).x, place.x - 1.2)
})

test('red mirrors blue', () => {
  const blue = tacticPilePlace('blue', 3)
  const red = tacticPilePlace('red', 3)
  near(red.x, -blue.x)
  near(red.z, -blue.z)
  assert.ok(red.x > TACTIC_PLATE_WIDTH / 2)
})

test('7 piles: 6 in the first row, the 7th in a second row behind it', () => {
  const places = freePilePlaces('blue', [], 7)
  assert.equal(places.length, 7)
  for (let i = 1; i < 6; i++) near(places[i].z, places[0].z)
  near(places[6].x, places[0].x)
  near(places[6].z, places[0].z + 1.2)
  const red = freePilePlaces('red', [], 7)
  near(red[6].z, red[0].z - 1.2)
})

test('places taken by existing piles are skipped', () => {
  const first = tacticPilePlace('blue', 0)
  const places = freePilePlaces('blue', [first], 1)
  assert.deepEqual(places[0], tacticPilePlace('blue', 1))
})
