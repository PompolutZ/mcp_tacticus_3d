import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import affiliationsData from '../scoreboard/affiliations.json' with { type: 'json' }
import { AFFILIATION_TOKENS, affiliationTokenKey } from './affiliationTokens.js'
import { characterToken } from './files.js'
import { TOKEN_GROUPS } from './groups.js'

test('every affiliation has a token with an image', () => {
  for (const [key, a] of Object.entries(affiliationsData)) {
    const token = AFFILIATION_TOKENS[affiliationTokenKey(key)]
    assert.ok(token, `affiliation ${key} has no token`)
    assert.equal(token.name, a.name)
    assert.equal(token.group, 'affiliation')
    const file = new URL(`../assets/${characterToken(affiliationTokenKey(key))}`, import.meta.url)
    assert.ok(fs.existsSync(file), `no image for ${key}`)
  }
  assert.equal(Object.keys(AFFILIATION_TOKENS).length, Object.keys(affiliationsData).length)
})

test('the Library has the Affiliation group', () => {
  assert.equal(TOKEN_GROUPS.affiliation, 'Affiliation')
})
