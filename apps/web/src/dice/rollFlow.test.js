import { test } from 'node:test'
import assert from 'node:assert/strict'
import { flowStage, restOutcome } from './rollFlow.js'

test('restOutcome: lost wins, then timed out or tilted waits, else flat', () => {
  assert.equal(restOutcome({ lost: true, timedOut: true, tilted: true }), 'lost')
  assert.equal(restOutcome({ lost: false, timedOut: true, tilted: false }), 'wait')
  assert.equal(restOutcome({ lost: false, timedOut: false, tilted: true }), 'wait')
  assert.equal(restOutcome({ lost: false, timedOut: false, tilted: false }), 'flat')
})

test('flowStage sorts the entries into rolling, sliding, flat and waiting', () => {
  const thrown = { state: 'thrown' }
  const flat = { state: 'well', symbol: 'x' }
  const waits = { state: 'well', symbol: null, waiting: true }
  const idle = { state: 'well', symbol: null, waiting: false }
  const moving = { state: 'shelf', moving: true }
  const still = { state: 'shelf', moving: false }
  const stage = flowStage([thrown, flat, waits, idle, moving, still])
  assert.equal(stage.rolling, true)
  assert.equal(stage.sliding, true)
  assert.deepEqual(stage.flat, [flat])
  assert.deepEqual(stage.waiting, [waits])
})

test('flowStage of no dice is quiet', () => {
  assert.deepEqual(flowStage([]), { rolling: false, sliding: false, flat: [], waiting: [] })
})
