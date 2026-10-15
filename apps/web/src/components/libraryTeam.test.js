import { test } from 'node:test'
import assert from 'node:assert/strict'
import { libraryTeam } from './libraryTeam.js'
import { tableSeat } from '../rooms/seat.js'

test('Sandbox and single player room: the chosen side', () => {
  assert.equal(libraryTeam(tableSeat(null), 'guest'), 'guest')
  assert.equal(libraryTeam(tableSeat({ multiplayer: false }), 'host'), 'host')
})

test('multiplayer: the own side, whatever is chosen', () => {
  assert.equal(libraryTeam(tableSeat({ multiplayer: true, side: 'host' }), 'guest'), 'host')
  assert.equal(libraryTeam(tableSeat({ multiplayer: true, side: 'guest' }), 'host'), 'guest')
})

test('multiplayer seat without a side: nobody', () => {
  assert.equal(libraryTeam(tableSeat({ multiplayer: true, side: null }), 'host'), null)
})
