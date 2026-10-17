import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { buildModelList, filterModels, sortBySize } from './modelList.js'

const names = JSON.parse(
  readFileSync(new URL('../characters/characters.json', import.meta.url), 'utf8'),
)
const root = new URL('../assets/characters/', import.meta.url)
const assets = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) =>
    readdirSync(new URL(`${d.name}/`, root))
      .filter((f) => f.endsWith('.glb'))
      .map((f) => [`characters/${d.name}/${f}`, `/url/${d.name}/${f}`]),
  )
const candidates = { '/model-candidates/zeta.glb': '/z', '/model-candidates/alpha.glb': '/a' }
const list = buildModelList({ candidates, assets, names })

test('candidates come first, then the game models', () => {
  const groups = list.map((r) => r.group)
  const firstGame = groups.indexOf('game')
  assert.equal(firstGame, 2)
  assert.ok(groups.slice(firstGame).every((g) => g === 'game'))
  assert.deepEqual(
    list.slice(0, 2).map((r) => r.name),
    ['alpha', 'zeta'],
  )
})

test('every character GLB is in the list once', () => {
  const ids = list.filter((r) => r.group === 'game').map((r) => r.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual(ids.sort(), assets.map(([path]) => path).sort())
})

test('a second model, a transform and a construct show their kind', () => {
  const kinds = (suffix) => list.filter((r) => r.name.endsWith(`(${suffix})`))
  assert.ok(kinds('model 2').length > 0)
  assert.ok(kinds('transform').length > 0)
  assert.ok(kinds('construct 1').length > 0)
})

test('a missing candidates folder gives only game models', () => {
  assert.ok(buildModelList({ candidates: {}, assets, names }).every((r) => r.group === 'game'))
})

test('the filter keeps only matching names, in any case', () => {
  const found = filterModels(list, ' ALPHA ')
  assert.ok(found.length > 0)
  assert.ok(found.every((r) => r.name.toLowerCase().includes('alpha')))
  assert.equal(filterModels(list, '').length, list.length)
})

test('sorted by size: largest first, unknown sizes last, no row lost', () => {
  // Sizes for every second row, from the row index, so that there are equal and unknown sizes
  const sizes = {}
  list.forEach((row, i) => {
    if (i % 2 === 0) sizes[row.url] = (i % 7) * 1000
  })
  const sorted = sortBySize(list, sizes)
  const known = sorted.filter((r) => r.url in sizes)
  const unknown = sorted.filter((r) => !(r.url in sizes))
  assert.deepEqual(sorted, [...known, ...unknown])
  for (let i = 1; i < known.length; i++) {
    assert.ok(sizes[known[i - 1].url] >= sizes[known[i].url])
  }
  assert.deepEqual(
    unknown,
    list.filter((r) => !(r.url in sizes)),
  )
  assert.deepEqual(sorted.map((r) => r.id).sort(), list.map((r) => r.id).sort())
})
