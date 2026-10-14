import test from 'node:test'
import assert from 'node:assert/strict'
import {
  chooseDeck,
  chooserOf,
  crisisRows,
  newSetup,
  pickCard,
  setPriority,
} from '../setup/setup.js'
import { crisisRowLayout, USE_BUTTON_X_TURNED } from './layout.js'
import { TABLE_DEPTH } from '../table.js'

const codes = ['a', 'b', 'c', 'd', 'e']
const turned = (card) => Math.abs(Math.cos(card.yaw)) > 0.5
const rect = (card) => {
  const w = turned(card) ? card.width : card.height
  const h = turned(card) ? card.height : card.width
  return { x0: card.x - w / 2, x1: card.x + w / 2, z0: card.z - h / 2, z1: card.z + h / 2 }
}
const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1

test('crisisRowLayout: no facing keeps yaw pi/2', () => {
  for (const card of crisisRowLayout('host', 'secure', codes)) assert.equal(card.yaw, Math.PI / 2)
})

test('crisisRowLayout: a row facing host has yaw 0, facing guest yaw pi', () => {
  for (const drawn of [false, true]) {
    for (const card of crisisRowLayout('guest', 'extract', codes.slice(0, 2), drawn, 'host'))
      assert.equal(card.yaw, 0)
    for (const card of crisisRowLayout('host', 'secure', codes.slice(0, 2), drawn, 'guest'))
      assert.equal(card.yaw, Math.PI)
  }
})

test('crisisRowLayout: turned cards do not overlap and end before the table edge', () => {
  for (const team of ['host', 'guest'])
    for (const type of ['secure', 'extract'])
      for (const drawn of [false, true])
        for (const n of [1, 2, 5, 7]) {
          const row = crisisRowLayout(team, type, codes.concat('f', 'g').slice(0, n), drawn, 'host')
          row.forEach((a, i) => {
            assert.ok(Math.abs(a.z) + a.height / 2 <= TABLE_DEPTH / 2 - 1 + 1e-9)
            for (const b of row.slice(i + 1)) assert.ok(!overlaps(rect(a), rect(b)), `${n}`)
          })
        }
})

test('crisisRowLayout: the two deck rows and the Use button keep clear of turned cards', () => {
  const secure = crisisRowLayout('host', 'secure', codes, false, 'host')
  const extract = crisisRowLayout('host', 'extract', codes, false, 'host')
  for (const a of secure) for (const b of extract) assert.ok(!overlaps(rect(a), rect(b)))
  const drawn = crisisRowLayout('host', 'secure', codes.slice(0, 2), true, 'host')
  for (const card of drawn) assert.ok(USE_BUTTON_X_TURNED + 0.5 < rect(card).x0)
})

const parsed = {
  host: { secure: codes, extract: codes },
  guest: { secure: codes, extract: codes },
}

test('crisisRows: facing is the chooser for the cards it picks from, null for the rest', () => {
  for (const winner of ['host', 'guest']) {
    const loser = winner === 'host' ? 'guest' : 'host'
    const deck = setPriority(newSetup(), winner)
    // Deck: both rows of the Priority player
    assert.equal(chooserOf(deck), winner)
    for (const row of crisisRows(deck, parsed))
      assert.equal(row.facing, row.team === winner ? winner : null)
    // First card: the 2 drawn cards of Priority, picked by the other player
    const first = chooseDeck(deck, 'secure', codes, () => 0)
    assert.deepEqual(
      crisisRows(first, parsed).map((r) => [r.team, r.use, r.facing]),
      [
        [winner, true, loser],
        [loser, false, null],
      ],
    )
    // Second card: the 2 drawn cards of the other player, picked by Priority
    const second = pickCard(first, 'a', codes, () => 0)
    assert.deepEqual(
      crisisRows(second, parsed).map((r) => [r.team, r.use, r.facing]),
      [
        [winner, false, null],
        [loser, true, winner],
      ],
    )
  }
})
