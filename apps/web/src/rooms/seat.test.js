import test from 'node:test'
import assert from 'node:assert/strict'
import { tableSeat } from './seat.js'

test('the Sandbox plays both sides as the host', () => {
  assert.deepEqual(tableSeat(null), {
    multiplayer: false,
    isGuest: false,
    ownSide: 'host',
    playedSides: ['host', 'guest'],
    hiddenSquads: false,
    mySide: null,
  })
})

test('a single player room plays both sides as the host', () => {
  const seat = tableSeat({ id: 'a', multiplayer: false, side: 'guest' })
  assert.equal(seat.isGuest, false)
  assert.equal(seat.ownSide, 'host')
  assert.deepEqual(seat.playedSides, ['host', 'guest'])
  assert.equal(seat.hiddenSquads, false)
  assert.equal(seat.mySide, null)
})

test('the host seat of a multiplayer room plays one side', () => {
  const seat = tableSeat({ multiplayer: true, side: 'host' })
  assert.equal(seat.isGuest, false)
  assert.equal(seat.ownSide, 'host')
  assert.deepEqual(seat.playedSides, ['host'])
  assert.equal(seat.hiddenSquads, true)
  assert.equal(seat.mySide, 'host')
})

test('the Red seat of a multiplayer room', () => {
  const seat = tableSeat({ multiplayer: true, side: 'guest' })
  assert.equal(seat.isGuest, true)
  assert.equal(seat.ownSide, 'guest')
  assert.deepEqual(seat.playedSides, ['guest'])
  assert.equal(seat.hiddenSquads, true)
  assert.equal(seat.mySide, 'guest')
})

test('a multiplayer room with no side hides the squads and has no side', () => {
  const seat = tableSeat({ multiplayer: true, side: null })
  assert.equal(seat.multiplayer, true)
  assert.equal(seat.hiddenSquads, true)
  assert.equal(seat.mySide, null)
  assert.equal(seat.ownSide, 'host')
  assert.deepEqual(seat.playedSides, ['host'])
})
