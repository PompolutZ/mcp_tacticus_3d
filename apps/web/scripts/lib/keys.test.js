import assert from 'node:assert/strict'
import { test } from 'node:test'
import { slug, uniqueKeys } from './keys.mjs'

test('slug removes apostrophes and dots', () => {
  assert.equal(slug("M'Kraan"), 'mkraan')
  assert.equal(slug('S.W.O.R.D.'), 'sword')
})

test('slug with keepPunctuation turns them into dashes', () => {
  assert.equal(slug("King T'Challa", { keepPunctuation: true }), 'king-t-challa')
  assert.equal(slug("King T'Challa"), 'king-tchalla')
})

test('uniqueKeys maps each row to its key', () => {
  const [a, b] = [{ name: "M'Kraan" }, { name: 'Other' }]
  assert.deepEqual(
    [...uniqueKeys([a, b])],
    [
      [a, 'mkraan'],
      [b, 'other'],
    ],
  )
})

test('uniqueKeys throws on a duplicate key', () => {
  const rows = [{ name: "M'Kraan" }, { name: 'MKraan' }]
  assert.throws(
    () => uniqueKeys(rows, { noun: 'tokens' }),
    /The tokens "M'Kraan" and "MKraan" have the same key mkraan/,
  )
})
