import test from 'node:test'
import assert from 'node:assert/strict'
import { gamePriority, priorityAfterCleanup, priorityNote, priorityTitle } from './priority.js'

const COLORS = { host: 'Blue', guest: 'Red' }
const SOLO = { mySide: null, players: null, peer: null, colors: COLORS }
const ROOM = {
  mySide: 'host',
  players: { host: { name: 'Oleh' }, guest: { name: 'Nelly' } },
  peer: null,
  colors: COLORS,
}

test('the marker is game.priority, also when it is null', () => {
  assert.equal(gamePriority({ priority: 'guest' }, { priority: 'host' }), 'guest')
  assert.equal(gamePriority({ priority: null }, { priority: 'host' }), null)
})

test('an old document has no marker field, and the roll-off winner has it', () => {
  assert.equal(gamePriority({}, { priority: 'host' }), 'host')
  assert.equal(gamePriority({}, { deck: { team: 'guest' } }), 'guest')
  assert.equal(gamePriority({}, { priority: null }), null)
})

test('Priority passes when its holder activated last', () => {
  assert.equal(priorityAfterCleanup('host', 'host'), 'guest')
  assert.equal(priorityAfterCleanup('guest', 'guest'), 'host')
})

test('Priority stays when the other side activated last, or nobody did', () => {
  assert.equal(priorityAfterCleanup('host', 'guest'), 'host')
  assert.equal(priorityAfterCleanup('host', null), 'host')
  assert.equal(priorityAfterCleanup('host', undefined), 'host')
})

test('with no marker, nothing is set', () => {
  assert.equal(priorityAfterCleanup(null, 'host'), null)
})

test('the Cleanup note names who has Priority', () => {
  assert.equal(priorityNote('host', 'guest', ROOM), 'Priority passes to Nelly.')
  assert.equal(priorityNote('guest', 'host', ROOM), 'Priority passes to you.')
  assert.equal(priorityNote('guest', 'guest', ROOM), 'Nelly keeps Priority.')
  assert.equal(priorityNote('host', 'host', ROOM), 'You keep Priority.')
  assert.equal(priorityNote('host', 'guest', SOLO), 'Priority passes to Red.')
  assert.equal(priorityNote(null, null, SOLO), '')
})

test('the title names who has Priority and who gets it', () => {
  assert.equal(priorityTitle('guest', ROOM), 'Nelly has Priority. Click to give it to you.')
  assert.equal(priorityTitle('host', ROOM), 'You have Priority. Click to give it to Nelly.')
  assert.equal(priorityTitle('host', SOLO), 'Blue has Priority. Click to give it to Red.')
})
