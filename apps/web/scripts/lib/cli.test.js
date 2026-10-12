import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseMigrateArgs } from './cli.mjs'

// The invalid and --help paths call process.exit, so only the valid path is tested.
// `node --test` starts this file without arguments.
test('parseMigrateArgs returns the options and positionals of a valid command line', () => {
  const { opts, positionals } = parseMigrateArgs('usage')
  assert.deepEqual({ ...opts }, {})
  assert.deepEqual(positionals, [])
})

test('parseMigrateArgs passes the parsed arguments to isValid', () => {
  let seen
  parseMigrateArgs('usage', (opts, positionals) => {
    seen = { opts, positionals }
    return true
  })
  assert.deepEqual({ ...seen.opts }, {})
  assert.deepEqual(seen.positionals, [])
})
