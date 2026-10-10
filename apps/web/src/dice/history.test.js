import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  changeEntry,
  clearEntry,
  countSymbols,
  countsText,
  entryText,
  throwEntry,
} from './history.js'

test('counts have only the symbols above 0', () => {
  assert.deepEqual(countSymbols(['hit', 'crit', 'hit']), { hit: 2, crit: 1 })
  assert.deepEqual(countSymbols([]), {})
})

test('counts text: most first, ties in shelf order', () => {
  assert.equal(countsText({ skull: 1, hit: 2, crit: 1, blank: 0 }), '2 Hit, 1 Crit, 1 Skull')
})

test('a throw entry has only the sources that have dice', () => {
  const entry = throwEntry('blue', 5, { roll: ['hit', 'hit', 'skull'], reroll: [['blank', 'hit']] })
  assert.match(entry.id, /^[0-9a-f]{8}$/)
  assert.deepEqual(
    { ...entry, id: undefined },
    {
      id: undefined,
      side: 'blue',
      at: 5,
      kind: 'throw',
      roll: { hit: 2, skull: 1 },
      reroll: [['blank', 'hit']],
    },
  )
  assert.equal(throwEntry('red', 5, {}), null)
})

test('change and clear entries', () => {
  assert.deepEqual(
    { ...changeEntry('red', 7, 'skull', 'block'), id: 0 },
    {
      id: 0,
      side: 'red',
      at: 7,
      kind: 'change',
      from: 'skull',
      to: 'block',
    },
  )
  const clear = clearEntry('blue', 9)
  assert.equal(clear.kind, 'clear')
  assert.equal(clear.at, 9)
})

test('the text of an entry', () => {
  const entry = throwEntry('blue', 1, {
    roll: ['hit', 'crit'],
    crits: ['wild'],
    reroll: [['blank', 'hit']],
  })
  assert.equal(entryText(entry), 'Roll: 1 Crit, 1 Hit. Crits: 1 Wild. Reroll: Blank → Hit')
  assert.equal(entryText(changeEntry('blue', 1, 'skull', 'block')), 'Changed: Skull → Block')
  assert.equal(entryText(clearEntry('blue', 1)), 'Cleared')
})
