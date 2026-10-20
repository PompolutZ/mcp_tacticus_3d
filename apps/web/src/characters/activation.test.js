import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activationTargets } from './activation.js'

const host = { id: 'h', tokens: {} }
const grunt = (id, tokens = {}, hostId = 'h') => ({ id, host: hostId, tokens })

test('grunts without Activated come first, the host gets nothing', () => {
  const chars = [host, grunt('g1'), grunt('g2', { activated: 1 }), grunt('g3')]
  assert.deepEqual(activationTargets(chars, 'h'), ['g1', 'g3'])
})

test('all grunts activated: the host', () => {
  const chars = [host, grunt('g1', { activated: 1 }), grunt('g2', { activated: 1 })]
  assert.deepEqual(activationTargets(chars, 'h'), ['h'])
})

test('a host with no grunts gets it; grunts of another host do not count', () => {
  assert.deepEqual(activationTargets([host, grunt('x', {}, 'other')], 'h'), ['h'])
})

test('an immune grunt is skipped, so the host is not blocked', () => {
  const chars = [host, grunt('g1'), grunt('g2', { activated: 1 })]
  assert.deepEqual(
    activationTargets(chars, 'h', (c) => c.id === 'g1'),
    ['h'],
  )
})
