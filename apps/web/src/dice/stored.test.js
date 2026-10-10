import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dieEntry, dieId, nextOrder, roundPose, trayCounts } from './stored.js'

test('a die id is 8 hex characters and is new when the tray has it', () => {
  const id = dieId(new Set())
  assert.match(id, /^[0-9a-f]{8}$/)
  const original = crypto.randomUUID
  const ids = ['abcdef01-0000', 'abcdef02-0000']
  crypto.randomUUID = () => ids.shift()
  try {
    assert.equal(dieId({ has: (x) => x === 'abcdef01' }), 'abcdef02')
  } finally {
    crypto.randomUUID = original
  }
})

test('roundPose rounds position to 3 and rotation to 4 decimals', () => {
  const pose = roundPose({ x: 1.23456, y: -0.0004, z: 2 }, { x: 0.123456, y: 0, z: 0, w: 0.99231 })
  assert.deepEqual(pose, { x: 1.235, y: -0, z: 2, qx: 0.1235, qy: 0, qz: 0, qw: 0.9923 })
})

test('roundPose gives null for a number that is not finite', () => {
  assert.equal(roundPose({ x: NaN, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }), null)
  assert.equal(roundPose({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: Infinity }), null)
})

test('dieEntry keeps the face on the shelf and the pose elsewhere', () => {
  const pose = { x: 0, y: 1, z: 2, qx: 0, qy: 0, qz: 0, qw: 1 }
  assert.deepEqual(dieEntry(1, 'shelf', { face: 3, pose }), { order: 1, place: 'shelf', face: 3 })
  assert.deepEqual(dieEntry(2, 'air', { pose }), { order: 2, place: 'air', pose })
  assert.deepEqual(dieEntry(3, 'well'), { order: 3, place: 'well' })
})

test('nextOrder is one above the highest', () => {
  assert.equal(nextOrder([]), 1)
  assert.equal(nextOrder([{ order: 4 }, { order: 2 }]), 5)
})

test('trayCounts reads the shelf by symbol and the rest as well', () => {
  const entries = {
    a: { order: 1, place: 'shelf', face: 5 }, // crit
    b: { order: 2, place: 'shelf', face: 3 }, // hit
    c: { order: 3, place: 'shelf', face: 6 }, // hit
    d: { order: 4, place: 'air' },
    e: { order: 5, place: 'well' },
  }
  assert.deepEqual(trayCounts(entries, false), {
    well: 2,
    shelf: { crit: 1, wild: 0, hit: 2, block: 0, blank: 0, skull: 0 },
    critsAvailable: 1,
  })
  assert.equal(trayCounts(entries, true).critsAvailable, 0)
})

test('trayCounts of no entries is all zero', () => {
  assert.deepEqual(trayCounts(undefined, false), {
    well: 0,
    shelf: { crit: 0, wild: 0, hit: 0, block: 0, blank: 0, skull: 0 },
    critsAvailable: 0,
  })
})
