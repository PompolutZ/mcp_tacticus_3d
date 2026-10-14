import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { addMapToIndex, importName } from './maps-index.mjs'

const INDEX = new URL('../../src/terrain/maps/index.js', import.meta.url)

test('import name from a map id', () => {
  assert.equal(importName('vibranium-heist'), 'vibraniumHeist')
  assert.equal(
    importName('dockyard-destruction-spider-man-to-blame'),
    'dockyardDestructionSpiderManToBlame',
  )
  assert.equal(importName('9-lives'), '_9Lives')
})

test('a map that is in index.js is not added again', () => {
  const source = fs.readFileSync(INDEX, 'utf8')
  assert.equal(addMapToIndex(source, 'vibranium-heist'), source)
})

test('a new map goes last, once', () => {
  const source = fs.readFileSync(INDEX, 'utf8')
  const next = addMapToIndex(source, 'new-map')
  assert.match(next, /import newMap from '\.\/new-map\.json' with \{ type: 'json' \}\n\n/)
  assert.match(next, /    swingIntoAction,\n    newMap,\n  \]\.map/)
  assert.equal(addMapToIndex(next, 'new-map'), next)
})
