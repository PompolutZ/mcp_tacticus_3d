import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FLIP_DURATION,
  createFlip,
  flipAngle,
  flipLift,
  startFlip,
  stepFlip,
} from './useFlipTurn.js'

test('starts at rest on its side, with no animation', () => {
  assert.equal(flipAngle(createFlip(false)), 0)
  assert.equal(flipAngle(createFlip(true)), Math.PI)
})

test('a flip ends on the other side, turning one more half turn', () => {
  const flip = createFlip(false)
  startFlip(flip, true)
  assert.equal(stepFlip(flip, FLIP_DURATION * 2), Math.PI)
  startFlip(flip, false)
  // Back to the first side by going on, not by turning back
  assert.equal(stepFlip(flip, FLIP_DURATION * 2), 2 * Math.PI)
})

test('the same side again does not flip', () => {
  const flip = createFlip(false)
  startFlip(flip, false)
  assert.equal(flip.time, FLIP_DURATION)
  assert.equal(flipAngle(flip), 0)
})

test('the angle only grows during a turn', () => {
  const flip = createFlip(false)
  startFlip(flip, true)
  let last = 0
  for (let i = 0; i < 20; i++) {
    const a = stepFlip(flip, FLIP_DURATION / 10)
    assert.ok(a >= last)
    last = a
  }
})

test('a flip during a flip starts from the current angle', () => {
  const flip = createFlip(false)
  startFlip(flip, true)
  const mid = stepFlip(flip, FLIP_DURATION / 2)
  assert.ok(mid > 0 && mid < Math.PI)
  startFlip(flip, false)
  assert.equal(flipAngle(flip), mid)
  assert.equal(stepFlip(flip, FLIP_DURATION * 2), 2 * Math.PI)
})

test('the lift is zero lying flat and highest on the edge', () => {
  assert.ok(Math.abs(flipLift(0, 3)) < 1e-9)
  assert.ok(Math.abs(flipLift(Math.PI, 3)) < 1e-9)
  assert.ok(flipLift(Math.PI / 2, 3) > flipLift(Math.PI / 4, 3))
  assert.ok(flipLift(Math.PI / 2, 3) > 3 / 2)
})
