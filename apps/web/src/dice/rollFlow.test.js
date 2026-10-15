import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contactStep, flowStage, restOutcome, rollBlocked } from './rollFlow.js'

test('restOutcome, throw tilted again: lost wins, then timed out or tilted waits, else flat', () => {
  const r = { rethrowTilted: true }
  assert.equal(restOutcome({ lost: true, timedOut: true, tilted: true, ...r }), 'lost')
  assert.equal(restOutcome({ lost: false, timedOut: true, tilted: false, ...r }), 'wait')
  assert.equal(restOutcome({ lost: false, timedOut: false, tilted: true, ...r }), 'wait')
  assert.equal(restOutcome({ lost: false, timedOut: false, tilted: false, ...r }), 'flat')
})

test('restOutcome, default: only a lost die is thrown again, tilted or timed out is flat', () => {
  for (const r of [{}, { rethrowTilted: false }]) {
    assert.equal(restOutcome({ lost: true, timedOut: true, tilted: true, ...r }), 'lost')
    assert.equal(restOutcome({ lost: false, timedOut: true, tilted: false, ...r }), 'flat')
    assert.equal(restOutcome({ lost: false, timedOut: false, tilted: true, ...r }), 'flat')
    assert.equal(restOutcome({ lost: false, timedOut: false, tilted: false, ...r }), 'flat')
  }
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

test('contactStep: a touch counts only after the die was off every contact', () => {
  assert.deepEqual(contactStep({ airborne: false, touching: true }), {
    airborne: false,
    contact: false,
  })
  assert.deepEqual(contactStep({ airborne: false, touching: false }), {
    airborne: true,
    contact: false,
  })
  assert.deepEqual(contactStep({ airborne: true, touching: false }), {
    airborne: true,
    contact: false,
  })
  assert.deepEqual(contactStep({ airborne: true, touching: true }), {
    airborne: true,
    contact: true,
  })
})

test('rollBlocked: only after a contact, while a die is thrown or waits', () => {
  assert.equal(rollBlocked({ contacted: false, rolling: true, waiting: true }), false)
  assert.equal(rollBlocked({ contacted: true, rolling: true, waiting: false }), true)
  assert.equal(rollBlocked({ contacted: true, rolling: false, waiting: true }), true)
  assert.equal(rollBlocked({ contacted: true, rolling: false, waiting: false }), false)
})
