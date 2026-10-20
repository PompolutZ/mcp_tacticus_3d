import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { createTable } from '../net/doc.js'
import { createCharacterActions } from './actions.js'
import { layoutTrays } from './trays.js'

const char = (id, patch = {}) => ({
  id,
  key: `k-${id}`,
  team: 'host',
  side: 'healthy',
  damage: 0,
  power: 0,
  tokens: {},
  ...patch,
})

// A table with fake lookups (the real ones load JSON, which Node tests do not)
function charTable(characters, tokens = []) {
  const table = createTable(new Y.Doc())
  table.game.set({ crisis: { secure: null, extract: null } })
  table.characters.set(characters)
  table.tokens.set(tokens)
  const logs = []
  const drops = []
  const actions = createCharacterActions(table, {
    newCharacters: (ch, team) => [char(`n-${ch.slug}-${team}`, { key: ch.slug, team })],
    characterStamina: () => 5,
    characterImmune: (key) => (key === 'k-imm' ? ['stun'] : []),
    isCappedToken: (key) => key === 'stun' || key === 'dazed' || key === 'activated',
    dropWait: (ch, offBoard) => ({ placeBy: 'guest', offBoard, of: ch.id }),
    crisis: { dropCharacterTokens: (id, wait) => drops.push([id, wait?.offBoard ?? null]) },
    writeLog: (kind, data) => logs.push([kind, data.characterId ?? data.to ?? null]),
    writeStatLog: (ch, stat, from, to) => logs.push([stat, from, to]),
    characterLogData: (ch) => ({ characterId: ch.id }),
    tokenEntryData: (ch, key, on, count) => ({ characterId: ch.id, key, on, count }),
  })
  return { table, actions, logs, drops }
}

const one = (table, id) => table.characters.read().find((c) => c.id === id)

test('spawn adds a character once for each player', () => {
  const { table, actions } = charTable([])
  assert.deepEqual(actions.spawn({ slug: 'a', team: 'host' }), { duplicate: false })
  assert.deepEqual(actions.spawn({ slug: 'a', team: 'host' }), { duplicate: true })
  assert.deepEqual(actions.spawn({ slug: 'a', team: 'guest' }), { duplicate: false })
  assert.equal(table.characters.read().length, 2)
})

test('damage and power are clamped and logged; a grunt has no power', () => {
  const { table, actions, logs } = charTable([char('c'), char('g', { host: 'c' })])
  actions.damage('c', 9)
  assert.equal(one(table, 'c').damage, 5)
  actions.damage('c', -2)
  assert.equal(one(table, 'c').damage, 0)
  actions.power('c', 15)
  assert.equal(one(table, 'c').power, 10)
  actions.power('g', 3)
  assert.equal(one(table, 'g').power, 0)
  actions.damage('missing', 1)
  assert.deepEqual(logs, [
    ['damage', 0, 5],
    ['damage', 5, 0],
    ['power', 0, 10],
  ])
})

test('flip turns the side and clears Damage; a grunt does not flip', () => {
  const { table, actions, logs } = charTable([char('c', { damage: 3 }), char('g', { host: 'c' })])
  actions.flip('c')
  assert.deepEqual([one(table, 'c').side, one(table, 'c').damage], ['injured', 0])
  actions.flip('g')
  assert.equal(one(table, 'g').side, 'healthy')
  assert.deepEqual(logs, [['flip', 'c']])
})

test('offBoard drops held tokens with a wait and keeps the models; with none, the models go back', () => {
  const held = { id: 't', heldBy: 'c' }
  const a = charTable([char('c')], [held])
  assert.deepEqual(a.actions.offBoard('c'), { returnModels: false })
  assert.deepEqual(a.drops, [['c', true]])
  assert.deepEqual(a.logs, [['offBoard', 'c']])
  const b = charTable([char('c')])
  assert.deepEqual(b.actions.offBoard('c'), { returnModels: true })
  assert.deepEqual(b.drops, [['c', null]])
})

test('remove takes the grunts, their poses and tokens; a grunt id removes nothing', () => {
  const { table, actions, logs, drops } = charTable([
    char('c'),
    char('g', { host: 'c' }),
    char('other'),
  ])
  table.poses.set({ c: { x: 0 }, g: { x: 1 }, other: { x: 2 } })
  assert.equal(actions.remove('g'), null)
  const removed = actions.remove('c')
  assert.deepEqual(removed.characters, ['c', 'g'])
  assert.deepEqual(
    table.characters.read().map((c) => c.id),
    ['other'],
  )
  assert.deepEqual(Object.keys(table.poses.read()), ['other'])
  assert.deepEqual(drops, [
    ['c', null],
    ['g', null],
  ])
  assert.deepEqual(logs, [['deleted', 'c']])
})

test('giveToken: immune does nothing; capped tokens stay at 1; Activated records the side; Dazed drops tokens', () => {
  const { table, actions, logs, drops } = charTable([char('c'), char('i', { key: 'k-imm' })])
  assert.equal(actions.giveToken('i', 'stun').given, false)
  assert.deepEqual(one(table, 'i').tokens, {})
  assert.equal(actions.giveToken('c', 'power').given, true)
  actions.giveToken('c', 'power')
  assert.equal(one(table, 'c').tokens.power, 2)
  actions.giveToken('c', 'activated')
  actions.giveToken('c', 'activated')
  assert.equal(one(table, 'c').tokens.activated, 1)
  assert.equal(table.game.get('lastActivated'), 'host')
  actions.giveToken('c', 'dazed')
  actions.giveToken('c', 'dazed')
  assert.deepEqual(drops, [['c', false]])
  // power x2, activated x1 (the second is at its limit), dazed x1
  assert.equal(logs.filter(([kind]) => kind === 'token').length, 4)
})

test('removeToken counts down and deletes the key at 0', () => {
  const { table, actions, logs } = charTable([char('c', { tokens: { power: 2 } })])
  actions.removeToken('c', 'power')
  assert.deepEqual(one(table, 'c').tokens, { power: 1 })
  actions.removeToken('c', 'power')
  assert.deepEqual(one(table, 'c').tokens, {})
  actions.removeToken('c', 'power')
  assert.equal(logs.length, 2)
})

test('swap: the order in the document changes, so the Streamer column order and the tray places follow', () => {
  const { table, actions } = charTable([
    char('a'),
    char('x', { team: 'guest' }),
    char('b'),
    char('c'),
  ])
  actions.swap('a', 'c')
  const column = (team) =>
    table.characters
      .read()
      .filter((ch) => ch.team === team)
      .map((ch) => ch.id)
  assert.deepEqual(column('host'), ['c', 'b', 'a'])
  assert.deepEqual(column('guest'), ['x'])
  const place = layoutTrays(table.characters.read())
  assert.ok(place.get('c')[0] < place.get('b')[0] && place.get('b')[0] < place.get('a')[0])
})

test('giveActivated: grunts first in one go, then the host; one log entry per character', () => {
  const { table, actions, logs } = charTable([
    char('h'),
    char('g1', { host: 'h' }),
    char('g2', { host: 'h', tokens: { activated: 1 } }),
    char('g3', { host: 'h' }),
  ])
  actions.giveActivated('h')
  const tk = () =>
    Object.fromEntries(table.characters.read().map((c) => [c.id, c.tokens.activated ?? 0]))
  assert.deepEqual(tk(), { h: 0, g1: 1, g2: 1, g3: 1 })
  assert.equal(logs.filter((l) => l[0] === 'token').length, 2)
  actions.giveActivated('h')
  assert.deepEqual(tk(), { h: 1, g1: 1, g2: 1, g3: 1 })
})
