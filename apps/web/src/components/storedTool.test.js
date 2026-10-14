import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  freeSpawnYaw,
  losEntry,
  losFields,
  newSpawnId,
  roundPose,
  roundTurn,
  sameLos,
  sameStored,
  spawnEntry,
  storedFields,
} from './storedTool.js'

const LIVE = {
  pose: { x: 1.23456, y: 0.0004, z: -2.9996, yaw: 1.234567 },
  turn: { right: 0.78539816, left: -0.78539816 },
  snap: { kind: 'character', id: 'c1', side: 'left', across: 1 },
  mode: 'away',
}

test('positions round to 3 decimals, yaw and bend to 4', () => {
  assert.deepEqual(roundPose(LIVE.pose), { x: 1.235, y: 0, z: -3, yaw: 1.2346 })
  assert.deepEqual(roundTurn(LIVE.turn), { right: 0.7854, left: -0.7854 })
})

test('storedFields rounds and keeps the snap and the mode', () => {
  const fields = storedFields(LIVE)
  assert.deepEqual(fields.snap, LIVE.snap)
  assert.equal(fields.mode, 'away')
  assert.equal(fields.pose.x, 1.235)
})

test('a snap without across stays without it', () => {
  const fields = storedFields({ ...LIVE, snap: { kind: 'token', id: 't', side: 'left' } })
  assert.deepEqual(fields.snap, { kind: 'token', id: 't', side: 'left' })
  assert.equal('across' in fields.snap, false)
})

test('sameStored compares the rounded fields', () => {
  const a = storedFields(LIVE)
  assert.equal(sameStored(a, storedFields(LIVE)), true)
  // A change below the rounding step is the same state
  const near = { ...LIVE, pose: { ...LIVE.pose, x: LIVE.pose.x + 0.0001 } }
  assert.equal(sameStored(a, storedFields(near)), true)
  const moved = { ...LIVE, pose: { ...LIVE.pose, x: LIVE.pose.x + 0.01 } }
  assert.equal(sameStored(a, storedFields(moved)), false)
  assert.equal(sameStored(a, storedFields({ ...LIVE, snap: null })), false)
  assert.equal(sameStored(a, storedFields({ ...LIVE, mode: 'toward' })), false)
  assert.equal(sameStored(a, storedFields({ ...LIVE, turn: { right: 0, left: 0 } })), false)
})

test('an entry without a pose is not the same as stored fields', () => {
  assert.equal(sameStored(storedFields(LIVE), { which: 3, spawn: 'x' }), false)
})

test('two null snaps are equal', () => {
  const a = storedFields({ ...LIVE, snap: null })
  assert.equal(sameStored(a, { ...a }), true)
})

test('the Red free spawn yaw is the Blue yaw + π', () => {
  assert.equal(freeSpawnYaw('host'), 0)
  assert.equal(freeSpawnYaw('guest'), freeSpawnYaw('host') + Math.PI)
})

test('spawn ids come from random, and differ for different numbers', () => {
  assert.equal(
    newSpawnId(() => 0),
    '00000000',
  )
  assert.notEqual(
    newSpawnId(() => 0.25),
    newSpawnId(() => 0.5),
  )
  assert.equal(newSpawnId(() => 0.999999999).length, 8)
})

test('a spawn entry has no pose, and a free one has a rounded at', () => {
  assert.deepEqual(
    spawnEntry('short', null, () => 0.5),
    { which: 'short', spawn: newSpawnId(() => 0.5) },
  )
  const free = spawnEntry(true, { x: 1.23456, z: -2 }, () => 0.5)
  assert.deepEqual(free.at, { x: 1.235, z: -2 })
  assert.equal('pose' in free, false)
})

test('a Line of Sight entry has a looker, no target and no pose', () => {
  const entry = losEntry('c1', () => 0.5)
  assert.deepEqual(entry, { which: true, spawn: newSpawnId(() => 0.5), looker: 'c1', target: null })
})

test('sameLos compares the rounded pose', () => {
  const a = losFields({ pose: LIVE.pose })
  assert.deepEqual(a, { pose: { x: 1.235, y: 0, z: -3, yaw: 1.2346 } })
  assert.equal(sameLos(a, losFields({ pose: { ...LIVE.pose, x: LIVE.pose.x + 0.0001 } })), true)
  assert.equal(sameLos(a, losFields({ pose: { ...LIVE.pose, yaw: LIVE.pose.yaw + 0.01 } })), false)
  // An entry that has not rested has no pose
  assert.equal(sameLos(a, { which: true, spawn: 'x', looker: 'c1', target: null }), false)
})
