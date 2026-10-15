import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { FACES } from '../dice/faces.js'
import { createTable } from '../net/doc.js'
import { deployLockWrite, readRollOffWrite } from './actions.js'
import { newSetup, placeSquad } from './setup.js'

// Two browsers: two documents that exchange updates. Both run the derived writes (docs/features/setup-game.md,
// "Roll off" and "Deploy Lock"), so the documents must end equal.
function sync(a, b) {
  const toB = Y.encodeStateAsUpdate(a.doc, Y.encodeStateVector(b.doc))
  const toA = Y.encodeStateAsUpdate(b.doc, Y.encodeStateVector(a.doc))
  Y.applyUpdate(b.doc, toB)
  Y.applyUpdate(a.doc, toA)
}

function browser() {
  const doc = new Y.Doc()
  return { doc, table: createTable(doc) }
}

function twoBrowsers(setup) {
  const a = browser()
  const b = browser()
  a.table.game.set({ priority: null, deployLine: false })
  a.table.setup.set(setup)
  sync(a, b)
  return [a, b]
}

const faceOf = (symbol) => FACES.findIndex((f) => f.symbol === symbol) + 1

// 5 dice on the shelf of `team`, all showing `symbol`
function throwShelf(browserOf, team, symbol) {
  const dice = {}
  for (let i = 0; i < 5; i++) dice[`${team}${i}`] = { place: 'shelf', face: faceOf(symbol) }
  browserOf.table.dice.setField(team, { critsUsed: 0, dice })
}

const snapshot = (x) => ({
  setup: x.table.setup.read(),
  game: x.table.game.read(),
  log: x.table.log.read().map((e) => e.id),
})

function assertSame(a, b) {
  assert.deepEqual(snapshot(a), snapshot(b))
}

const rollOffEntries = (x) => x.table.log.read().filter((e) => e.kind === 'rollOff')

test('roll off: the throws arrive one after the other, both browsers read', () => {
  for (const [first, second] of [
    ['host', 'guest'],
    ['guest', 'host'],
  ]) {
    const [a, b] = twoBrowsers(newSetup())
    const by = { host: a, guest: b }
    throwShelf(by[first], first, first === 'host' ? 'crit' : 'blank')
    sync(a, b)
    assert.equal(readRollOffWrite(a.table, { mySide: 'host', throwId: 't1' }), false)
    throwShelf(by[second], second, second === 'host' ? 'crit' : 'blank')
    sync(a, b)
    // Both browsers read, each in its own document, before the other write arrives
    readRollOffWrite(a.table, { mySide: 'host', throwId: 't2' })
    readRollOffWrite(b.table, { mySide: 'guest', throwId: 't2' })
    sync(a, b)
    assertSame(a, b)
    assert.equal(a.table.setup.read().priority, 'host')
    assert.equal(a.table.game.get('priority'), 'host')
    assert.equal(rollOffEntries(a).length, 1)
    assert.equal(rollOffEntries(a)[0].id, `rolloff:${a.table.setup.read().id}:t2`)
    // A second run in either browser writes nothing
    assert.equal(readRollOffWrite(a.table, { mySide: 'host', throwId: 't2' }), false)
    assert.equal(readRollOffWrite(b.table, { mySide: 'guest', throwId: 't2' }), false)
  }
})

test('roll off: both players throw at the same moment', () => {
  const [a, b] = twoBrowsers(newSetup())
  throwShelf(a, 'host', 'hit')
  throwShelf(b, 'guest', 'crit')
  // Neither browser has both shelves yet: nobody reads
  assert.equal(readRollOffWrite(a.table, { mySide: 'host', throwId: 'x' }), false)
  assert.equal(readRollOffWrite(b.table, { mySide: 'guest', throwId: 'y' }), false)
  sync(a, b)
  // The throws arrive in both browsers; each one reads with the id of the last throw it knows
  readRollOffWrite(a.table, { mySide: 'host', throwId: 'same' })
  readRollOffWrite(b.table, { mySide: 'guest', throwId: 'same' })
  sync(a, b)
  assertSame(a, b)
  assert.equal(a.table.setup.read().priority, 'guest')
  assert.equal(rollOffEntries(a).length, 1)
})

// A setup at the end of the squads step: both players Ready, both squads placed in different browsers
function placedInBoth() {
  const base = { ...newSetup(), threat: 18, ready: { host: true, guest: true } }
  const [a, b] = twoBrowsers(base)
  const squad = { characters: [0], tactics: [] }
  const placed = { characters: [], tactics: [] }
  a.table.setup.set((prev) => placeSquad(prev, 'host', squad, placed))
  b.table.setup.set((prev) => placeSquad(prev, 'guest', squad, placed))
  return [a, b]
}

test('Deploy Lock: both squads placed at the same time, on once', () => {
  const [a, b] = placedInBoth()
  // Each browser sees only its own squad: no lock yet
  assert.equal(deployLockWrite(a.table), false)
  assert.equal(deployLockWrite(b.table), false)
  sync(a, b)
  assert.equal(deployLockWrite(a.table), true)
  assert.equal(deployLockWrite(b.table), true)
  sync(a, b)
  assertSame(a, b)
  assert.equal(a.table.game.get('deployLine'), true)
  assert.equal(a.table.setup.read().lockSet, true)
  assert.equal(deployLockWrite(a.table), false)
  assert.equal(deployLockWrite(b.table), false)
})

test('Deploy Lock: a hand toggle after the lock stays', () => {
  const [a, b] = placedInBoth()
  sync(a, b)
  deployLockWrite(a.table)
  sync(a, b)
  b.table.game.setField('deployLine', false)
  assert.equal(deployLockWrite(b.table), false)
  assert.equal(deployLockWrite(a.table), false)
  sync(a, b)
  assertSame(a, b)
  assert.equal(a.table.game.get('deployLine'), false)
})
