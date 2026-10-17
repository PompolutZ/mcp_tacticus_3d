import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { SYMBOLS } from '../dice/faces.js'
import { diceIconFile } from './diceIcons.js'

test('every dice symbol but blank has a face icon file that exists', () => {
  for (const symbol of SYMBOLS.filter((s) => s !== 'blank')) {
    const file = diceIconFile(symbol)
    assert.ok(file, symbol)
    assert.ok(existsSync(new URL(`../assets/tactic-icons/${file}.webp`, import.meta.url)), symbol)
  }
})

test('blank has no icon', () => {
  assert.equal(diceIconFile('blank'), null)
})
