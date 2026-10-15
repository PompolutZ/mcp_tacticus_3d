import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SPECIAL_CONDITIONS, formImmunities, parseImmunity, sharedImmunities } from './immunity.js'

const read = (file) => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'))
const rows = read('../../scripts/jarvis/characters.json')
const tokens = read('../tokens/tokens.json')
const row = (slug) => rows.find((r) => r.slug === slug)
const sorted = (list) => [...list].sort()

test('Blue Marvel: Incinerate and Stun on both sides', () => {
  assert.deepEqual(sharedImmunities(row('blue-marvel')), {
    healthy: ['incinerate', 'stun'],
    injured: ['incinerate', 'stun'],
  })
})

test('Apocalypse: three Healthy, every special condition Injured', () => {
  const { healthy, injured } = sharedImmunities(row('apocalypse'))
  assert.deepEqual(sorted(healthy), ['bleed', 'incinerate', 'stun'])
  assert.deepEqual(sorted(injured), sorted(SPECIAL_CONDITIONS))
})

test('Emma Frost: none on form 1, four on form 2, so none are shared', () => {
  const [first, second] = formImmunities(row('emma-frost'))
  assert.deepEqual(first, { healthy: [], injured: [] })
  assert.deepEqual(sorted(second.healthy), ['bleed', 'incinerate', 'poison', 'stun'])
  assert.deepEqual(sorted(second.injured), ['bleed', 'incinerate', 'poison', 'stun'])
  assert.deepEqual(sharedImmunities(row('emma-frost')), { healthy: [], injured: [] })
})

test('a character with no immunity', () => {
  const none = rows.find((r) => !JSON.stringify(r.statCard).includes('mmun'))
  assert.deepEqual(sharedImmunities(none), { healthy: [], injured: [] })
})

test('name variants', () => {
  assert.deepEqual(parseImmunity('Flight, Immune [Incinerate, Poison], Peerless'), [
    'incinerate',
    'poison',
  ])
  assert.deepEqual(parseImmunity('Vol, Immunité [Hémorragie, Poison]'), ['bleed', 'poison'])
  assert.deepEqual(parseImmunity('Psychic Immunity'), [])
})

test('SPECIAL_CONDITIONS is the condition group of tokens.json', () => {
  const conditions = Object.keys(tokens).filter((k) => tokens[k].group === 'condition')
  assert.deepEqual(sorted(SPECIAL_CONDITIONS), sorted(conditions))
})

test('every immunity name of every Jarvis row maps to a token key', () => {
  const unmapped = []
  for (const r of rows)
    for (const form of formImmunities(r))
      for (const key of [...form.healthy, ...form.injured])
        if (!(key in tokens)) unmapped.push(`${r.slug}: ${key}`)
  assert.deepEqual(unmapped, [])
})

// Havok has the text but no tag, so the text may have more than the tags, never fewer.
test('every immuneTo* tag of a row is in the immunities of its text', () => {
  const differ = []
  for (const r of rows) {
    const fromText = new Set(formImmunities(r).flatMap((f) => [...f.healthy, ...f.injured]))
    const fromTags = new Set(
      r.tags
        .filter((t) => t.startsWith('immuneTo'))
        .map((t) => t.slice(8).toLowerCase().replace('judgment', 'judgement')),
    )
    if ([...fromTags].some((key) => !fromText.has(key))) differ.push(r.slug)
  }
  assert.deepEqual(differ, [])
})
