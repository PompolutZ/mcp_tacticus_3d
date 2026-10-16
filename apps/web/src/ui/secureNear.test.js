import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nearSecureIds, placementHeld } from './secureNear.js'
import { rangeLength } from '../tabletools/toolTips.js'

const base = 1
const tokenR = 0.5
const center = { x: 0, z: 0 }
// A token whose edge is `gap` inches from the base edge
const at = (id, gap) => ({ id, x: base + tokenR + gap, z: 0 })

test('range 2 includes a token that range 1 excludes', () => {
  const tokens = [at('near', 0.5), at('mid', 1.5), at('far', 4)]
  assert.deepEqual(nearSecureIds(center, base, tokenR, tokens, 1), ['near'])
  assert.deepEqual(nearSecureIds(center, base, tokenR, tokens, 2), ['near', 'mid'])
})

test('a held model has no near tokens', () => {
  assert.deepEqual(nearSecureIds(center, base, tokenR, [at('a', 0)], 1, true), [])
})

test('a placement is final only when nothing claims or moves the model', () => {
  const rest = { owner: null, dragging: false, lifted: false, asleep: true }
  assert.equal(placementHeld(rest), false)
  assert.equal(placementHeld({ ...rest, owner: 'other' }), true)
  assert.equal(placementHeld({ ...rest, owner: 'me' }), true)
  assert.equal(placementHeld({ ...rest, dragging: true }), true)
  assert.equal(placementHeld({ ...rest, lifted: true }), true)
  assert.equal(placementHeld({ ...rest, asleep: false }), true)
})

test('range 2 reaches as far as the Range 2 tool', () => {
  const length = rangeLength(2)
  const tokens = [at('tool end', length - 0.001), at('past', length + 0.1)]
  assert.deepEqual(nearSecureIds(center, base, tokenR, tokens, 2), ['tool end'])
})
