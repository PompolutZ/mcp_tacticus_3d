import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import { isCollectedEntry } from './collect.js'

const tokens = JSON.parse(fs.readFileSync(new URL('./tokens.json', import.meta.url), 'utf8'))

test('collect flag on the chosen tokens', () => {
  for (const key of [
    'sleuthevidence',
    'memory',
    'genetic-sample',
    'hit',
    'crit',
    'fail',
    'wild',
    'shield',
    'blank',
  ]) {
    assert.equal(isCollectedEntry(tokens[key]), true)
  }
})

test('other tokens and unknown keys are not collected', () => {
  assert.equal(isCollectedEntry(tokens.lmd), false)
  assert.equal(isCollectedEntry(tokens['no-such-token']), false)
})
