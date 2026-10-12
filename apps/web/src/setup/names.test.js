import assert from 'node:assert/strict'
import { test } from 'node:test'
import { capital, isYou, playerName, possessive, says, verbFor } from './names.js'

const colors = { host: 'Blue', guest: 'Red' }
const room = {
  mySide: 'host',
  players: { host: { name: 'Me' }, guest: { name: 'Nelly' } },
  peer: null,
  colors,
}
const sandbox = { mySide: null, players: null, peer: null, colors: { host: 'Red', guest: 'Blue' } }

test('multiplayer room: You and the Discord name', () => {
  assert.equal(playerName('host', room), 'You')
  assert.equal(playerName('guest', room), 'Nelly')
  assert.equal(possessive('host', room), 'my')
  assert.equal(possessive('guest', room), "Nelly's")
  assert.equal(isYou('host', room), true)
  assert.equal(isYou('guest', room), false)
})

test('the other seat: peer, deleted player, fallback', () => {
  const free = { ...room, players: { host: { name: 'Me' }, guest: null } }
  assert.equal(playerName('guest', free), 'Opponent')
  assert.equal(playerName('guest', { ...free, peer: { name: 'Pia' } }), 'Pia')
  assert.equal(
    playerName('guest', { ...free, players: { guest: { gone: true } } }),
    'Deleted player',
  )
  assert.equal(possessive('guest', free), "Opponent's")
})

test('Sandbox and single player room: the color name, never You', () => {
  assert.equal(playerName('host', sandbox), 'Red')
  assert.equal(playerName('guest', sandbox), 'Blue')
  assert.equal(possessive('host', sandbox), "Red's")
  assert.equal(isYou('host', sandbox), false)
})

test('verbs agree with the name', () => {
  assert.equal(says('host', room, 'choose'), 'You choose')
  assert.equal(says('guest', room, 'choose'), 'Nelly chooses')
  assert.equal(says('guest', room, 'have'), 'Nelly has')
  assert.equal(says('host', room, 'have'), 'You have')
  assert.equal(says('host', sandbox, 'win'), 'Red wins')
  assert.equal(says('guest', room, 'deploy'), 'Nelly deploys')
  assert.equal(verbFor('guest', room, 'pass'), 'passes')
  assert.equal(verbFor('guest', room, 'try'), 'tries')
})

test('capital', () => {
  assert.equal(capital('my roster'), 'My roster')
})
