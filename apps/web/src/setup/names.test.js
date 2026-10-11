import assert from 'node:assert/strict'
import { test } from 'node:test'
import { capital, isYou, playerName, possessive, says, verbFor } from './names.js'

const colors = { blue: 'Blue', red: 'Red' }
const room = {
  mySide: 'blue',
  players: { blue: { name: 'Me' }, red: { name: 'Nelly' } },
  peer: null,
  colors,
}
const sandbox = { mySide: null, players: null, peer: null, colors: { blue: 'Red', red: 'Blue' } }

test('multiplayer room: You and the Discord name', () => {
  assert.equal(playerName('blue', room), 'You')
  assert.equal(playerName('red', room), 'Nelly')
  assert.equal(possessive('blue', room), 'my')
  assert.equal(possessive('red', room), "Nelly's")
  assert.equal(isYou('blue', room), true)
  assert.equal(isYou('red', room), false)
})

test('the other seat: peer, deleted player, fallback', () => {
  const free = { ...room, players: { blue: { name: 'Me' }, red: null } }
  assert.equal(playerName('red', free), 'Opponent')
  assert.equal(playerName('red', { ...free, peer: { name: 'Pia' } }), 'Pia')
  assert.equal(playerName('red', { ...free, players: { red: { gone: true } } }), 'Deleted player')
  assert.equal(possessive('red', free), "Opponent's")
})

test('Sandbox and single player room: the color name, never You', () => {
  assert.equal(playerName('blue', sandbox), 'Red')
  assert.equal(playerName('red', sandbox), 'Blue')
  assert.equal(possessive('blue', sandbox), "Red's")
  assert.equal(isYou('blue', sandbox), false)
})

test('verbs agree with the name', () => {
  assert.equal(says('blue', room, 'choose'), 'You choose')
  assert.equal(says('red', room, 'choose'), 'Nelly chooses')
  assert.equal(says('red', room, 'have'), 'Nelly has')
  assert.equal(says('blue', room, 'have'), 'You have')
  assert.equal(says('blue', sandbox, 'win'), 'Red wins')
  assert.equal(says('red', room, 'deploy'), 'Nelly deploys')
  assert.equal(verbFor('red', room, 'pass'), 'passes')
  assert.equal(verbFor('red', room, 'try'), 'tries')
})

test('capital', () => {
  assert.equal(capital('my roster'), 'My roster')
})
