import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { createTable } from '../net/doc.js'
import { createCrisisActions } from './actions.js'
import { newSetup } from '../setup/setup.js'

const CARDS = {
  a: { key: 'a', supply: 'sup' },
  b: { key: 'b', supply: null },
}
const token = (id, patch = {}) => ({
  id,
  cardKey: 'a',
  frontKey: 'objective',
  x: 0,
  z: 0,
  up: 'front',
  canFlip: true,
  heldBy: null,
  heldAt: null,
  ...patch,
})

// A table with two characters and fake lookups (the real ones load JSON, which Node tests do not)
function crisisTable(tokens = []) {
  const table = createTable(new Y.Doc())
  table.game.set({ crisis: { secure: null, extract: null } })
  table.setup.set(newSetup())
  table.characters.set([
    { id: 'c1', base: 'medium', team: 'host' },
    { id: 'c2', base: 'medium', team: 'guest' },
  ])
  table.tokens.set(tokens)
  const logs = []
  const actions = createCrisisActions(table, {
    getCard: (key) => CARDS[key] ?? null,
    buildMatTokens: (card, turned) => [token(`mat-${card.key}-${turned}`, { cardKey: card.key })],
    supplyToken: (card, x, z, id) => token(id, { cardKey: card.key, frontKey: card.supply, x, z }),
    trayHeldDefault: (count) => [count, 0],
    tokenName: (key) => key,
    modelPosition: (id) => (id === 'c1' ? { x: 10, z: 20 } : undefined),
    writeLog: (kind, data) => logs.push([kind, data.tokenId]),
    writeHeldLog: (ch, t, on) => ch && logs.push(['held', t.id, on]),
    characterLogData: (ch) => ({ characterId: ch.id }),
  })
  return { table, actions, logs }
}

const ids = (table) => table.tokens.read().map((t) => t.id)

test('changeCrisis swaps the card and its tokens, and turns them with the Priority', () => {
  const { table, actions } = crisisTable()
  actions.changeCrisis('secure', 'a')
  assert.equal(table.game.get('crisis').secure, 'a')
  assert.deepEqual(ids(table), ['mat-a-false'])
  table.setup.set({ ...table.setup.read(), priority: 'guest' })
  actions.changeCrisis('secure', 'b')
  assert.deepEqual(ids(table), ['mat-b-true'])
  actions.changeCrisis('secure', null)
  assert.equal(table.game.get('crisis').secure, null)
  assert.deepEqual(ids(table), [])
})

test('changeCrisis removes the supply tokens of the old card too', () => {
  const { table, actions } = crisisTable([
    token('s1', { cardKey: 'a' }),
    token('o', { cardKey: 'b' }),
  ])
  table.game.setField('crisis', { secure: 'a', extract: null })
  actions.changeCrisis('secure', null)
  assert.deepEqual(ids(table), ['o'])
})

test('token patches and flip', () => {
  const { table, actions } = crisisTable([token('t'), token('n', { canFlip: false })])
  actions.turnToken('t', 1.5)
  actions.controlToken('t', 'host')
  actions.damageToken('t', true)
  actions.flipToken('t')
  actions.flipToken('n')
  const [t, n] = table.tokens.read()
  assert.deepEqual([t.yaw, t.control, t.damage, t.up], [1.5, 'host', true, 'back'])
  assert.equal(n.up, 'front')
})

test('hold gives the token to a character, with a log entry; a move on its card has none', () => {
  const { table, actions, logs } = crisisTable([token('t'), token('u', { heldBy: 'c1' })])
  actions.holdToken('t', 'c1', null)
  const t = table.tokens.read().find((x) => x.id === 't')
  assert.deepEqual([t.heldBy, t.heldAt], ['c1', [1, 0]])
  assert.deepEqual(logs, [['held', 't', true]])
  actions.holdToken('t', 'c1', [3, 4])
  assert.deepEqual(table.tokens.read().find((x) => x.id === 't').heldAt, [3, 4])
  assert.equal(logs.length, 1)
})

test('moveToken releases a held token on the table', () => {
  const { table, actions, logs } = crisisTable([token('t', { heldBy: 'c1', heldAt: [0, 0] })])
  assert.deepEqual(actions.moveToken('t', 5, 6), [])
  const t = table.tokens.read()[0]
  assert.deepEqual([t.x, t.z, t.heldBy, t.heldAt], [5, 6, null, null])
  assert.deepEqual(logs, [['held', 't', false]])
})

test('supplyTake adds a token on the table or on a character; no supply, nothing', () => {
  const { table, actions, logs } = crisisTable()
  actions.supplyTake('a', 1, 2, null, 'x')
  actions.supplyTake('a', 0, 0, 'c2', 'y')
  actions.supplyTake('b', 0, 0, null, 'z')
  assert.deepEqual(ids(table), ['x', 'y'])
  const y = table.tokens.read()[1]
  assert.deepEqual([y.heldBy, y.heldAt], ['c2', [0, 0]])
  assert.deepEqual(logs, [['held', 'y', true]])
})

test('removeHeld removes only a held token', () => {
  const { table, actions } = crisisTable([token('t'), token('h', { heldBy: 'c1' })])
  assert.equal(actions.removeHeld('t'), false)
  assert.equal(actions.removeHeld('h'), true)
  assert.deepEqual(ids(table), ['t'])
})

test('dropCharacterTokens drops next to the model; with a wait it marks the tokens and logs', () => {
  const { table, actions, logs } = crisisTable([
    token('a1', { heldBy: 'c1' }),
    token('a2', { heldBy: 'c1' }),
    token('b1', { heldBy: 'c2' }),
  ])
  actions.dropCharacterTokens('c1', { placeBy: 'guest', offBoard: true })
  const [a1, a2, b1] = table.tokens.read()
  assert.equal(a1.heldBy, null)
  assert.equal(a2.heldBy, null)
  assert.equal(b1.heldBy, 'c2')
  assert.equal(a1.placeBy, 'guest')
  assert.equal(a1.placeFrom.characterId, 'c1')
  assert.notEqual(a1.z, a2.z)
  assert.deepEqual(logs, [
    ['dropped', 'a1'],
    ['dropped', 'a2'],
  ])
})

test('placeTokens places a waiting token once and tells which models go back', () => {
  const { table, actions, logs } = crisisTable([token('a1', { heldBy: 'c1' })])
  actions.dropCharacterTokens('c1', { placeBy: 'guest', offBoard: true })
  logs.length = 0
  assert.deepEqual(actions.placeTokens(['a1'], { a1: { x: 7, z: 8 } }), ['c1'])
  const t = table.tokens.read()[0]
  assert.deepEqual([t.x, t.z, t.placeBy], [7, 8, null])
  assert.deepEqual(logs, [['placed', 'a1']])
  assert.deepEqual(actions.placeTokens(['a1']), [])
  assert.equal(logs.length, 1)
})
