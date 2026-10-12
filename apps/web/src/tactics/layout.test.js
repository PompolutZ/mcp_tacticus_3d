import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cardPiles,
  freePilePlaces,
  tacticPilePlace,
  tacticSlotPosition,
  TACTIC_PLATE_WIDTH,
} from './layout.js'

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)

test('host: first pile lies 0.3" past the left end of the plate, in the slot row', () => {
  const place = tacticPilePlace('host', 0)
  near(place.x, -(TACTIC_PLATE_WIDTH / 2 + 0.3 + 0.5))
  near(place.z, tacticSlotPosition('host', 0).z)
  near(tacticPilePlace('host', 1).x, place.x - 1.2)
})

test('red mirrors blue', () => {
  const blue = tacticPilePlace('host', 3)
  const red = tacticPilePlace('guest', 3)
  near(red.x, -blue.x)
  near(red.z, -blue.z)
  assert.ok(red.x > TACTIC_PLATE_WIDTH / 2)
})

test('7 piles: 6 in the first row, the 7th in a second row behind it', () => {
  const places = freePilePlaces('host', [], 7)
  assert.equal(places.length, 7)
  for (let i = 1; i < 6; i++) near(places[i].z, places[0].z)
  near(places[6].x, places[0].x)
  near(places[6].z, places[0].z + 1.2)
  const red = freePilePlaces('guest', [], 7)
  near(red[6].z, red[0].z - 1.2)
})

test('places taken by existing piles are skipped', () => {
  const first = tacticPilePlace('host', 0)
  const places = freePilePlaces('host', [first], 1)
  assert.deepEqual(places[0], tacticPilePlace('host', 1))
})

test('cardPiles: one pile per token, host cards first, on free places, linked to the card', () => {
  const tokensOf = (key) => ({ a: ['x', 'y'], b: ['z'], c: [] })[key] ?? []
  const cards = [
    { id: 'c1', key: 'a', team: 'guest' },
    { id: 'c2', key: 'b', team: 'host' },
    { id: 'c3', key: 'c', team: 'host' },
    { id: 'c4', key: 'unknown', team: 'host' },
  ]
  const piles = cardPiles(cards, [], tokensOf)
  assert.deepEqual(
    piles.map((p) => [p.card, p.key]),
    [
      ['c2', 'z'],
      ['c1', 'x'],
      ['c1', 'y'],
    ],
  )
  assert.equal(new Set(piles.map((p) => p.id)).size, 3)
  const host = freePilePlaces('host', [], 1)[0]
  assert.deepEqual([piles[0].x, piles[0].z], [host.x, host.z])
  const guest = freePilePlaces('guest', [], 2)
  assert.deepEqual([piles[2].x, piles[2].z], [guest[1].x, guest[1].z])
})

test('cardPiles: skips places that existing piles take', () => {
  const first = freePilePlaces('host', [], 1)[0]
  const [pile] = cardPiles([{ id: 'c', key: 'a', team: 'host' }], [first], () => ['x'])
  const second = tacticPilePlace('host', 1)
  assert.deepEqual([pile.x, pile.z], [second.x, second.z])
})

test('cardPiles: no cards, no piles', () => {
  assert.deepEqual(
    cardPiles([], [], () => ['x']),
    [],
  )
})
