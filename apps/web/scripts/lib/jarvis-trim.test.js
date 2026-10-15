import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { trimCharacters, trimCrisis, trimTactics } from './jarvis-trim.mjs'

const read = (file) =>
  JSON.parse(readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8'))

const characters = read('characters/jarvis-characters.json')
const crisis = read('crisis/jarvis-crisis-cards.json')

// A stale trimmed file means trim-jarvis was not run after a change to the raw data or to a parser.
test('the committed trimmed files match a fresh trim', () => {
  assert.deepEqual(read('characters/jarvis-rows.json'), trimCharacters(characters))
  assert.deepEqual(
    read('tactics/jarvis-rows.json'),
    trimTactics(read('tactics/jarvis-tactics-cards.json')),
  )
  assert.deepEqual(read('crisis/jarvis-rows.json'), trimCrisis(crisis))
})

test('a variable stamina ("?") gives 0', () => {
  const row = { slug: 'x', name: 'X', statCard: { frontSide: { stamina: '?' }, backSide: null } }
  assert.equal(trimCharacters([row])[0].staminaHealthy, 0)
})

test('a grunt has no Injured stamina', () => {
  const grunt = trimCharacters(characters).find((r) => r.isGrunt)
  assert.ok(grunt.staminaHealthy > 0)
  assert.equal(grunt.staminaInjured, 0)
})

test('an alternate sculpt row is kept with its flag', () => {
  const rows = trimCharacters(characters)
  assert.equal(rows.length, characters.length)
  assert.equal(rows.find((r) => r.slug === 'mephisto-convention-exclusive').isAlternateSculpt, true)
})

test('crisis: older printings are left out, kept rows have replacedBy null', () => {
  const old = crisis.filter((r) => r.replacedBy !== null)
  assert.ok(old.length > 0)
  const rows = trimCrisis(crisis)
  assert.equal(rows.length, crisis.length - old.length)
  assert.ok(rows.every((r) => r.replacedBy === null))
})
