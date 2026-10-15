// The card files of the app (cards.json) and the trimmed Jarvis rows must agree on the card ids.
// src/crisis/cards.js and src/tactics/cards.js do not load in Node, so this reads the JSON.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file) => JSON.parse(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'))

const tactics = read('src/tactics/cards.json')
const crisis = read('src/crisis/cards.json')
const crisisRows = read('src/crisis/jarvis-rows.json')

// The Library search is `id.startsWith(query)`, so a 7-digit id would miss a search by its 8-digit code.
test('every tactic id has 8 digits', () => {
  for (const [key, card] of Object.entries(tactics)) assert.match(card.id, /^\d{8}$/, key)
})

test('a search by the 8-digit code finds a card whose id lost its zero in the mod', () => {
  const found = Object.values(tactics).filter((card) => card.id.startsWith('01430206'))
  assert.equal(found.length, 1)
})

test('every crisis id has 8 digits and one current Jarvis printing', () => {
  for (const [key, card] of Object.entries(crisis)) {
    assert.match(card.id, /^\d{8}$/, key)
    const current = crisisRows.filter((r) => r.exportCode === card.id && r.replacedBy === null)
    assert.equal(current.length, 1, `${key} (${card.id})`)
  }
})

test('crisis cards.json has no threat: it comes from Jarvis', () => {
  for (const card of Object.values(crisis)) assert.equal('threat' in card, false)
})
