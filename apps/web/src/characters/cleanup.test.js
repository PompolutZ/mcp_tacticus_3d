import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cleanupBlockers, cleanupCharacter } from './cleanup.js'

const tokenData = JSON.parse(
  readFileSync(new URL('../tokens/tokens.json', import.meta.url), 'utf8'),
)
const cleanupKeys = Object.keys(tokenData).filter((k) => tokenData[k].cleanup)

const char = (over) => ({
  id: 'c1',
  key: 'hulk',
  team: 'host',
  side: 'healthy',
  damage: 0,
  power: 2,
  tokens: {},
  transform: {},
  ...over,
})

test('cleanup keys come from tokens.json', () => {
  assert.equal(cleanupKeys.length, 41)
  assert.ok(cleanupKeys.includes('activated'))
  assert.ok(cleanupKeys.includes('winging-it'))
})

test('Dazed Healthy: Injured, Damage 0, only the non-cleanup token stays', () => {
  const ch = char({
    damage: 4,
    tokens: {
      dazed: 1,
      bleed: 1,
      stun: 1,
      activated: 1,
      'winging-it': 2,
      energy: 1,
    },
  })
  const out = cleanupCharacter(ch, cleanupKeys)
  assert.equal(out.side, 'injured')
  assert.equal(out.damage, 0)
  assert.deepEqual(out.tokens, { energy: 1 })
  assert.equal(out.power, 2)
})

test('Dazed Injured stays Injured', () => {
  const out = cleanupCharacter(
    char({ side: 'injured', damage: 3, tokens: { dazed: 1 } }),
    cleanupKeys,
  )
  assert.equal(out.side, 'injured')
  assert.equal(out.damage, 0)
  assert.deepEqual(out.tokens, {})
})

test('not Dazed: keeps conditions and Damage, loses Activated and cleanup tokens', () => {
  const ch = char({ damage: 3, tokens: { activated: 1, 'winging-it': 1, poison: 1, bleed: 2 } })
  const out = cleanupCharacter(ch, cleanupKeys)
  assert.equal(out.side, 'healthy')
  assert.equal(out.damage, 3)
  assert.deepEqual(out.tokens, { poison: 1, bleed: 2 })
})

test('cleanupKeys may be a Set; nothing to change returns the same object', () => {
  const ch = char({ tokens: { poison: 1 } })
  assert.equal(cleanupCharacter(ch, new Set(cleanupKeys)), ch)
})

test('cleanupBlockers: on the board without Activated or Dazed', () => {
  const on = { x: 0, z: 0 }
  const a = char({ id: 'a' })
  const b = char({ id: 'b', tokens: { activated: 1 } })
  const c = char({ id: 'c', tokens: { dazed: 1 } })
  const d = char({ id: 'd' })
  const poses = { a: on, b: on, c: on, d: { x: 100, z: 0 } }
  const blockers = cleanupBlockers([a, b, c, d], poses)
  assert.deepEqual(
    blockers.map((x) => x.id),
    ['a'],
  )
})

test('a Dazed grunt has no Injured side: it keeps side and Damage, loses Dazed and conditions', () => {
  const grunt = char({ host: 'h1', damage: 1, tokens: { dazed: 1, bleed: 1, activated: 1 } })
  const out = cleanupCharacter(grunt, cleanupKeys)
  assert.equal(out.side, 'healthy')
  assert.equal(out.damage, 1)
  assert.deepEqual(out.tokens, {})
})
