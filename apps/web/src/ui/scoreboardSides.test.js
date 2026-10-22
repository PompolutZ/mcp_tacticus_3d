import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreboardSides } from './scoreboardSides.js'

const COLORS = { host: 'blue', guest: 'red' }
const NAMES = { host: 'Blue', guest: 'Red' }
const ctx = (mySide, players = null, peer = null) => ({
  mySide,
  players,
  peer,
  colors: NAMES,
})
const teams = (sides) => sides.map((s) => s.team)

test('Sandbox and single player room: host left, no tags, names by color', () => {
  const sides = scoreboardSides(ctx(null), COLORS, undefined)
  assert.deepEqual(teams(sides), ['host', 'guest'])
  assert.deepEqual(
    sides.map((s) => s.tag),
    [null, null],
  )
  assert.deepEqual(
    sides.map((s) => s.name),
    ['Blue', 'Red'],
  )
})

test('the left side is mine, the sides are never the same team', () => {
  for (const mine of ['host', 'guest']) {
    const sides = scoreboardSides(ctx(mine, { host: null, guest: null }), COLORS, 'connected')
    assert.equal(sides[0].team, mine)
    assert.notEqual(sides[0].team, sides[1].team)
  }
})

test('own tag is You and shows the account name; the other shows the connection', () => {
  const players = { host: { name: 'alice' }, guest: { name: 'James' } }
  const [mine, other] = scoreboardSides(ctx('guest', players), COLORS, 'reconnecting')
  assert.equal(mine.name, 'James')
  assert.deepEqual(mine.tag, { kind: 'you', text: 'You' })
  assert.equal(other.name, 'alice')
  assert.equal(other.tag.kind, 'reconnecting')
})

test('a free seat has no tag until the hello of the peer arrives', () => {
  const players = { host: { name: 'alice' }, guest: null }
  assert.equal(scoreboardSides(ctx('host', players), COLORS, 'waiting')[1].tag, null)
  const withPeer = scoreboardSides(ctx('host', players, { name: 'James' }), COLORS, 'connected')
  assert.equal(withPeer[1].name, 'James')
  assert.equal(withPeer[1].tag.kind, 'connected')
})

test('a deleted player has no connection tag', () => {
  const players = { host: { name: 'alice' }, guest: { gone: true } }
  assert.equal(scoreboardSides(ctx('host', players), COLORS, 'connected')[1].tag, null)
})

test('the color follows the side', () => {
  const swapped = { host: 'red', guest: 'blue' }
  const sides = scoreboardSides(ctx(null), swapped, undefined)
  assert.deepEqual(
    sides.map((s) => s.color),
    ['red', 'blue'],
  )
})
