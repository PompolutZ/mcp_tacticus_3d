import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { createTable } from '../net/doc.js'
import { createPhaseActions } from './actions.js'
import { newSetup } from '../setup/setup.js'
import { ROUND_POINTS } from '../scoreboard/board.js'

const char = (id, patch = {}) => ({
  id,
  key: `k-${id}`,
  team: 'host',
  side: 'healthy',
  damage: 0,
  power: 1,
  tokens: {},
  ...patch,
})

// A table with fake lookups (the real ones load JSON, which Node tests do not). Characters stand on the mat.
function phaseTable({ characters = [], setup = {}, game = {} } = {}) {
  const table = createTable(new Y.Doc())
  table.game.set({
    crisis: { secure: null, extract: null },
    deployLine: true,
    scoreMarkers: { round: { x: ROUND_POINTS[0].x, z: ROUND_POINTS[0].z } },
    ...game,
  })
  table.setup.set({ ...newSetup(), ...setup })
  table.characters.set(characters)
  table.poses.set(Object.fromEntries(characters.map((c) => [c.id, { x: 0, z: 0 }])))
  const logs = []
  const actions = createPhaseActions(table, {
    characterIsGrunt: (key) => key === 'k-g',
    characterName: (key) => key,
    characterPowerBonus: () => 0,
    getCard: () => null,
    cleanupKeys: ['stun'],
    writeLog: (kind, data, id) => logs.push([kind, id ?? data.side ?? null]),
  })
  return { table, actions, logs }
}

const one = (table, id) => table.characters.read().find((c) => c.id === id)

test('power gives Power to the characters of the sides on the mat, not grunts, with a log entry per side', () => {
  const { table, actions, logs } = phaseTable({
    characters: [char('a'), char('b', { team: 'guest' }), char('g', { key: 'k-g' })],
  })
  table.poses.set({ a: { x: 0, z: 0 }, g: { x: 0, z: 0 } })
  const { gains } = actions.power(['host', 'guest'])
  assert.deepEqual(
    gains.map((g) => g.name),
    ['k-a'],
  )
  assert.equal(one(table, 'a').power, 2)
  assert.equal(one(table, 'b').power, 1)
  assert.equal(one(table, 'g').power, 1)
  assert.deepEqual(logs, [['power', 'host']])
})

test('the first power phase ends the deployment once', () => {
  const { table, actions, logs } = phaseTable({
    characters: [char('a')],
    setup: {
      id: 's1',
      deployed: false,
      priority: 'host',
      deck: { team: 'host', type: 'secure' },
      picks: { secure: 'x', extract: 'y' },
      threat: 10,
      edge: 'e',
      ready: { host: true, guest: true },
      placed: { host: { characters: [], tactics: [] }, guest: { characters: [], tactics: [] } },
      affiliation: null,
    },
  })
  actions.power(['host'])
  actions.power(['host'])
  assert.equal(table.setup.read().deployed, true)
  assert.equal(table.game.get('deployLine'), false)
  assert.equal(logs.filter(([kind]) => kind === 'deployed').length, 1)
})

test('cleanup does nothing when a character on the board has no Activated or Dazed', () => {
  const { table, actions, logs } = phaseTable({ characters: [char('a')] })
  assert.equal(actions.cleanup(), null)
  assert.equal(one(table, 'a').power, 1)
  assert.deepEqual(logs, [])
})

test('cleanup: no character on the board does nothing', () => {
  const { actions } = phaseTable({ characters: [] })
  assert.equal(actions.cleanup(), null)
})

test('cleanup flips Dazed, moves the round and passes Priority to the other side', () => {
  const { table, actions, logs } = phaseTable({
    characters: [
      char('a', { tokens: { activated: 1, stun: 1 } }),
      char('b', { team: 'guest', tokens: { dazed: 1 } }),
    ],
    game: { priority: 'host', lastActivated: 'host' },
  })
  const done = actions.cleanup()
  assert.deepEqual(
    [done.round, done.flipped, done.before, done.after],
    [2, ['k-b'], 'host', 'guest'],
  )
  assert.deepEqual(one(table, 'a').tokens, {})
  assert.equal(one(table, 'b').side, 'injured')
  assert.equal(table.game.get('priority'), 'guest')
  assert.equal(table.game.get('lastActivated'), null)
  assert.deepEqual(table.game.get('scoreMarkers').round, ROUND_POINTS[1])
  assert.deepEqual(logs, [['cleanup', null]])
})

test('priorityClick gives Priority to the other side, with a log entry; no marker, nothing', () => {
  const { table, actions, logs } = phaseTable({ game: { priority: 'host' } })
  actions.priorityClick()
  assert.equal(table.game.get('priority'), 'guest')
  assert.deepEqual(logs, [['priority', 'guest']])
  const none = phaseTable({ game: { priority: null } })
  none.actions.priorityClick()
  assert.deepEqual(none.logs, [])
})
