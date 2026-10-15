import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dropPlacer } from './dropPlacer.js'

const rows = JSON.parse(
  readFileSync(new URL('../../scripts/jarvis/characters.json', import.meta.url), 'utf8'),
)
const row = (slug) => rows.find((r) => r.slug === slug)

test('The Black Widow: the controlling player places, on both sides', () => {
  assert.equal(dropPlacer({ side: 'healthy' }, row('the-black-widow')), 'controller')
  assert.equal(dropPlacer({ side: 'injured' }, row('the-black-widow')), 'controller')
})

test('S.H.I.E.L.D. Agents: the controlling player places', () => {
  assert.equal(dropPlacer({ side: 'healthy' }, row('shield-agents-grunts')), 'controller')
})

test('Hulk: the opponent places', () => {
  assert.equal(dropPlacer({ side: 'healthy' }, row('hulk')), 'opponent')
  assert.equal(dropPlacer({ side: 'injured' }, row('hulk')), 'opponent')
})

test('only these characters have the text', () => {
  const slugs = rows
    .filter((r) => dropPlacer({ side: 'healthy' }, r) === 'controller')
    .map((r) => r.slug)
  assert.deepEqual(slugs.sort(), ['shield-agents-grunts', 'the-black-widow'])
})

test('a side with no stat card side is the opponent', () => {
  const agents = row('shield-agents-grunts')
  assert.equal(dropPlacer({ side: 'injured' }, agents), 'opponent')
})
