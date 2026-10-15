import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runCardLoop } from './cardLoop.mjs'

const cache = new Set()
const base = {
  keys: { get: (c) => c.name },
  available: (f) => cache.has(f.file),
  convertPlan: () => ({ status: 'converted', warnings: ['w'] }),
}
const plans = {
  ok: { files: [{ file: 'a', url: 'u-a', label: 'face' }] },
  gone: {
    files: [
      { file: 'a', url: 'u-a', label: 'face' },
      { file: 'b', url: 'u-b', label: 'token x' },
    ],
  },
}

test('converts cards that have their files and keeps the plan', async () => {
  cache.clear()
  cache.add('a')
  const { results, done } = await runCardLoop({
    ...base,
    cards: [{ name: 'one' }],
    planCard: () => plans.ok,
    download: false,
  })
  assert.deepEqual(results, [
    { key: 'one', card: { name: 'one' }, status: 'converted', warnings: ['w'] },
  ])
  assert.deepEqual(done, [plans.ok])
})

test('a file missing in the cache gives a status and no conversion', async () => {
  cache.clear()
  cache.add('a')
  const { results, done } = await runCardLoop({
    ...base,
    cards: [{ name: 'one' }],
    planCard: () => plans.gone,
    download: false,
  })
  assert.equal(results[0].status, 'missing in TTS cache: token x')
  assert.equal(done.length, 0)
})

test('download gets the urls of the missing files; a failure is reported', async () => {
  cache.clear()
  cache.add('a')
  const asked = []
  const { results } = await runCardLoop({
    ...base,
    cards: [{ name: 'one' }],
    planCard: () => plans.gone,
    download: async (urls) => {
      asked.push(urls)
      return [{ url: 'u-b', reason: '404' }]
    },
  })
  assert.deepEqual(asked, [['u-b']])
  assert.equal(results[0].status, 'failed: download u-b (404)')
})

test('a thrown error fails that card only', async () => {
  cache.clear()
  cache.add('a')
  const { results, done } = await runCardLoop({
    ...base,
    cards: [{ name: 'bad' }, { name: 'good' }],
    planCard: (c) => {
      if (c.name === 'bad') throw new Error('no type')
      return plans.ok
    },
    download: false,
  })
  assert.equal(results[0].status, 'failed: no type')
  assert.equal(results[1].status, 'converted')
  assert.equal(done.length, 1)
})

test('cards run in the order of their keys', async () => {
  cache.clear()
  cache.add('a')
  const { results } = await runCardLoop({
    ...base,
    cards: [{ name: 'b' }, { name: 'a' }],
    planCard: () => plans.ok,
    download: false,
  })
  assert.deepEqual(
    results.map((r) => r.key),
    ['a', 'b'],
  )
})
