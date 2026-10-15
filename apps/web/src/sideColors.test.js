import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TEAMS } from './setup/setup.js'
import { COLOR_HEX, COLOR_NAME, DEFAULT_SIDE_COLORS } from './sideColors.js'

test('default colors are by host and guest', () => {
  assert.deepEqual(DEFAULT_SIDE_COLORS, { host: 'blue', guest: 'red' })
})

test('each team has a named, hex color', () => {
  for (const team of TEAMS) {
    const color = DEFAULT_SIDE_COLORS[team]
    assert.ok(COLOR_NAME[color], team)
    assert.ok(COLOR_HEX[color], team)
  }
})
