import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { createTable } from '../net/doc.js'
import { createSetupActions } from './actions.js'
import { newSetup, setupStep } from './setup.js'

const DECKS = { secure: ['s1', 's2', 's3'], extract: ['e1', 'e2', 'e3'] }

// A table with two rosters and fake lookups (the real ones load JSON, which Node tests do not)
function setupTable(patch = {}, context = {}) {
  const table = createTable(new Y.Doc())
  table.game.set({ crisis: { secure: null, extract: null }, deployLine: true, affiliations: {} })
  table.rosters.set({ host: { code: 'host' }, guest: { code: 'guest' } })
  table.setup.set({ ...newSetup(), ...patch })
  const calls = []
  const actions = createSetupActions(table, {
    mySide: 'host',
    hiddenSquads: false,
    rosterCard: (code) => (code ? { key: `key-${code}`, name: `Name ${code}` } : null),
    parseRosterText: () => DECKS,
    affiliationChoices: () => ['avengers'],
    characters: {
      remove: (id) => {
        calls.push(['removeCharacter', id])
        table.characters.set((list) => list.filter((c) => c.id !== id))
      },
    },
    crisis: {
      changeCrisis: (type, key) => {
        calls.push(['changeCrisis', type, key])
        table.game.setField('crisis', (prev) => ({ ...prev, [type]: key }))
      },
    },
    ...context,
  })
  return { table, actions, calls }
}

const kinds = (table) => table.log.read().map((e) => e.kind)

test('priority sets the setup, the marker and the log, only at the roll off', () => {
  const { table, actions } = setupTable()
  actions.priority('guest')
  assert.equal(table.setup.read().priority, 'guest')
  assert.equal(table.game.get('priority'), 'guest')
  assert.deepEqual(kinds(table), ['rollOff'])
  actions.priority('host')
  assert.equal(table.setup.read().priority, 'guest')
  assert.equal(table.log.read().length, 1)
})

test('deck and pick on the wrong step do nothing', () => {
  const { table, actions } = setupTable()
  actions.deck('secure')
  actions.pick('s1')
  assert.equal(table.setup.read().deck, null)
  assert.equal(table.log.read().length, 0)
  table.setup.set({ ...newSetup(), priority: 'host', deck: { type: 'secure' } })
  actions.deck('extract')
  assert.deepEqual(table.setup.read().deck, { type: 'secure' })
  assert.equal(table.log.read().length, 0)
})

test('deck draws two cards, pick uses one and draws from the other deck', () => {
  const { table, actions } = setupTable({ priority: 'host' })
  actions.deck('secure')
  assert.equal(setupStep(table.setup.read()), 'first')
  assert.equal(table.setup.read().draws.secure.length, 2)
  actions.pick('s1')
  const after = table.setup.read()
  assert.equal(after.picks.secure, 's1')
  assert.equal(after.draws.extract.length, 2)
  assert.equal(setupStep(after), 'second')
  assert.deepEqual(kinds(table), ['deck', 'pick'])
  assert.equal(table.log.read()[1].card, 'Name s1')
})

test('threat and edge write the choice; edge puts the crisis cards and names missing ones', () => {
  const { table, actions, calls } = setupTable(
    {
      priority: 'host',
      deck: { type: 'secure' },
      picks: { secure: 's1', extract: 'e1' },
    },
    { rosterCard: (code) => (code === 'e1' ? { name: 'No files' } : { key: `key-${code}` }) },
  )
  actions.threat(12)
  assert.equal(table.setup.read().threat, 12)
  const { missing } = actions.edge()
  assert.deepEqual(missing, ['No files'])
  assert.equal(table.setup.read().edge, true)
  assert.deepEqual(calls, [
    ['changeCrisis', 'secure', 'key-s1'],
    ['changeCrisis', 'extract', null],
  ])
  assert.deepEqual(kinds(table), ['threat', 'edge'])
})

test('restart removes only what the setup placed', () => {
  const { table, actions, calls } = setupTable({
    priority: 'host',
    deck: { type: 'secure' },
    picks: { secure: 's1', extract: 'e1' },
    threat: 12,
    edge: true,
    ready: { host: true, guest: true },
    placed: {
      host: { characters: ['c1'], tactics: ['t1'] },
      guest: { characters: [], tactics: [] },
    },
  })
  table.characters.set([{ id: 'c1' }, { id: 'c2' }])
  table.tactics.set([{ id: 't1' }, { id: 't2' }])
  table.tokenPiles.set([{ id: 'p1', card: 't1' }, { id: 'p2', card: 't2' }, { id: 'p3' }])
  table.game.setField('crisis', { secure: 'key-s1', extract: 'changed-by-player' })
  assert.equal(actions.restart(), true)
  assert.deepEqual(
    table.characters.read().map((c) => c.id),
    ['c2'],
  )
  assert.deepEqual(
    table.tactics.read().map((c) => c.id),
    ['t2'],
  )
  assert.deepEqual(
    table.tokenPiles.read().map((p) => p.id),
    ['p2', 'p3'],
  )
  assert.deepEqual(calls, [
    ['removeCharacter', 'c1'],
    ['changeCrisis', 'secure', null],
  ])
  assert.equal(table.game.get('deployLine'), false)
  assert.equal(setupStep(table.setup.read()), 'rollOff')
  assert.equal(table.game.get('priority'), null)
  assert.deepEqual(kinds(table), ['restart'])
})

test('restart at the deck step changes nothing', () => {
  const { table, actions } = setupTable({ priority: 'host' })
  assert.equal(actions.restart(), false)
  assert.equal(table.setup.read().priority, 'host')
  assert.equal(table.log.read().length, 0)
})

test('loadRoster and removeRoster write the roster and restart the setup', () => {
  const { table, actions } = setupTable({ priority: 'host', deck: { type: 'secure' } })
  const result = actions.loadRoster('guest', { unknown: ['999'], characters: [], tactics: [] })
  assert.equal(result.restarted, true)
  assert.deepEqual(result.unknown, ['999'])
  assert.equal(typeof table.rosters.read().guest.code, 'string')
  assert.equal(setupStep(table.setup.read()), 'rollOff')
  assert.equal(actions.removeRoster('host').restarted, true)
  assert.equal(table.rosters.read().host, null)
})

test('override to rollOff clears the marker and drops the later choices', () => {
  const { table, actions } = setupTable({ priority: 'host', deck: { type: 'secure' } })
  table.game.set({ ...table.game.read(), priority: 'host', lastActivated: 'c1' })
  actions.override('rollOff')
  const setup = table.setup.read()
  assert.equal(setup.priority, null)
  assert.equal(setup.deck, null)
  assert.equal(table.game.get('priority'), null)
  assert.equal(table.game.get('lastActivated'), null)
  assert.deepEqual(kinds(table), ['override'])
})

test('browse sets the viewed step', () => {
  const { table, actions } = setupTable({ priority: 'host' })
  actions.browse('rollOff')
  assert.equal(table.setup.read().view, 'rollOff')
  actions.browse(null)
  assert.equal(table.setup.read().view, null)
})

test('affiliation writes the setup and the marker at its step, for a known choice', () => {
  const placed = { characters: [], tactics: [] }
  const { table, actions } = setupTable({
    priority: 'host',
    deck: { type: 'secure' },
    picks: { secure: 's1', extract: 'e1' },
    threat: 12,
    edge: true,
    ready: { host: true, guest: true },
    placed: { host: placed, guest: placed },
  })
  assert.equal(setupStep(table.setup.read()), 'affiliation')
  actions.affiliation('host', 'shield')
  assert.equal(table.setup.read().affiliation.host, null)
  actions.affiliation('host', 'avengers')
  assert.equal(table.setup.read().affiliation.host, 'avengers')
  assert.equal(table.game.get('affiliations').host, 'avengers')
  assert.deepEqual(kinds(table), ['affiliation'])
})
